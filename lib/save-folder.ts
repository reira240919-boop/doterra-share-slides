// PowerPoint を、担当者が選んだ保存先フォルダ（デスクトップの「ドテラスライド」など）の中の
// 「2026年10月」のような年月のフォルダに保存する。
// Chrome / Edge のフォルダ保存の仕組み（File System Access API）を使う。
// 一度選んだフォルダは、このブラウザの中（IndexedDB）に覚えておき、次から聞かない。
// この仕組みが無いブラウザ（Safari など）では、ふつうのダウンロードにする。

const DB_NAME = "share-slides";
const STORE = "handles";
const KEY = "save-folder";

// ブラウザの型定義に、まだ入っていない部分
type PermissionMode = { mode: "readwrite" };
type DirHandle = FileSystemDirectoryHandle & {
  queryPermission(opts: PermissionMode): Promise<PermissionState>;
  requestPermission(opts: PermissionMode): Promise<PermissionState>;
};
type PickerWindow = Window & {
  showDirectoryPicker(opts: { id: string; mode: "readwrite"; startIn: "desktop" }): Promise<DirHandle>;
};

export function canSaveToFolder(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadHandle(): Promise<DirHandle | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as DirHandle) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function storeHandle(handle: DirHandle): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(handle, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // 覚えておけなくても、今回の保存はできる
  }
}

// 保存先フォルダの名前（まだ選んでいなければ null）
export async function savedFolderName(): Promise<string | null> {
  return (await loadHandle())?.name ?? null;
}

export class FolderPickCanceled extends Error {}

// 保存先フォルダを（あらためて）選ぶ
export async function pickFolder(): Promise<DirHandle> {
  try {
    const handle = await (window as unknown as PickerWindow).showDirectoryPicker({ id: "doterra-slides", mode: "readwrite", startIn: "desktop" });
    await storeHandle(handle);
    return handle;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new FolderPickCanceled();
    throw e;
  }
}

// 覚えているフォルダを使う。無いときや、書き込みの許可が取れないときは選び直してもらう
async function folderForSave(): Promise<DirHandle> {
  const saved = await loadHandle();
  if (saved) {
    const mode: PermissionMode = { mode: "readwrite" };
    if ((await saved.queryPermission(mode)) === "granted") return saved;
    if ((await saved.requestPermission(mode)) === "granted") return saved;
  }
  return pickFolder();
}

// 同じ名前のファイルがあれば、上書きせずに「(2)」のように番号を付ける
async function freeFileName(dir: FileSystemDirectoryHandle, fileName: string): Promise<string> {
  const dot = fileName.lastIndexOf(".");
  const base = fileName.slice(0, dot);
  const ext = fileName.slice(dot);
  for (let n = 1; n < 100; n++) {
    const name = n === 1 ? fileName : `${base}(${n})${ext}`;
    try {
      await dir.getFileHandle(name);
    } catch {
      return name;
    }
  }
  return `${base}_${Date.now()}${ext}`;
}

// 年月のフォルダを作って（あれば使って）保存する。保存した場所を「ドテラスライド/2026年10月/…」の形で返す
export async function saveToMonthFolder(params: {
  year: number;
  month: number;
  fileName: string;
  blob: Blob;
}): Promise<string> {
  const root = await folderForSave();
  const monthName = `${params.year}年${params.month}月`;
  const monthDir = await root.getDirectoryHandle(monthName, { create: true });
  const name = await freeFileName(monthDir, params.fileName);
  const file = await monthDir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(params.blob);
  await writable.close();
  return `${root.name}/${monthName}/${name}`;
}
