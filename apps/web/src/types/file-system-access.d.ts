// TypeScript's bundled `lib.dom.d.ts` already declares `FileSystemFileHandle`/
// `FileSystemDirectoryHandle` (createWritable/getFileHandle/etc.), but not
// yet the entry points that produce them, or the separate Permissions
// extension — both real, shipping parts of the File System Access API.
export {};

interface FileSystemPermissionDescriptor {
	mode?: "read" | "readwrite";
}

interface FileSystemHandlePermissions {
	queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
	requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
}

declare global {
	interface FileSystemHandle extends FileSystemHandlePermissions {}

	interface DirectoryPickerOptions {
		id?: string;
		mode?: "read" | "readwrite";
		startIn?:
			| FileSystemHandle
			| "desktop"
			| "documents"
			| "downloads"
			| "music"
			| "pictures"
			| "videos";
	}

	interface FilePickerAcceptType {
		description?: string;
		accept: Record<string, string | string[]>;
	}

	interface SaveFilePickerOptions {
		suggestedName?: string;
		types?: FilePickerAcceptType[];
		excludeAcceptAllOption?: boolean;
		startIn?: DirectoryPickerOptions["startIn"];
	}

	interface OpenFilePickerOptions {
		multiple?: boolean;
		types?: FilePickerAcceptType[];
		excludeAcceptAllOption?: boolean;
		startIn?: DirectoryPickerOptions["startIn"];
	}

	interface Window {
		showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
		showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
		showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
	}
}
