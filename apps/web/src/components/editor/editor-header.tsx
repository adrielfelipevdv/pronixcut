"use client";

import { Button } from "../ui/button";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExportButton } from "./export-button";
import { ThemeToggle } from "../theme-toggle";
import { toast } from "sonner";
import { useEditor } from "@/editor/use-editor";
import Image from "next/image";
import { cn } from "@/utils/ui";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowTurnBackwardIcon,
	ArrowTurnForwardIcon,
	KeyboardIcon,
} from "@hugeicons/core-free-icons";
import { ShortcutsDialog } from "@/actions/components/shortcuts-dialog";
import { AboutPopover } from "@/updater/components/about-popover";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { invokeAction } from "@/actions";
import { FloppyDiskIcon } from "@hugeicons/core-free-icons";

export function EditorHeader() {
	return (
		<header className="bg-background border-border flex h-[60px] items-center justify-between gap-3 border-b px-3">
			<div className="flex min-w-0 items-center gap-2">
				<HomeButton />
				<span className="mr-1 ml-0.5 hidden text-[13px] font-bold tracking-wide select-none sm:inline">
					<span className="text-foreground">PRONIX</span>
					<span className="text-primary">CUT</span>
				</span>
				<span className="bg-border mr-1 h-6 w-px shrink-0" />
				<EditableProjectName />
				<SaveStatus />
			</div>
			<nav className="flex shrink-0 items-center gap-1">
				<HistoryControls />
				<span className="bg-border mx-1.5 h-6 w-px" />
				<ShortcutsButton />
				<ExportButton />
				<ThemeToggle />
				<AboutPopover />
			</nav>
		</header>
	);
}

function ShortcutsButton() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				className="size-8 rounded-md"
				onClick={() => setIsOpen(true)}
				title="Atalhos"
			>
				<HugeiconsIcon icon={KeyboardIcon} className="size-4" />
			</Button>
			<ShortcutsDialog isOpen={isOpen} onOpenChange={setIsOpen} />
		</>
	);
}

function SaveStatus() {
	const isDirty = useEditor((e) => e.save.getIsDirty());

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="text-subtle hover:bg-accent hover:text-foreground ml-1 hidden cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] transition-colors duration-150 select-none md:flex"
				>
					<span
						className={cn(
							"size-1.5 rounded-full transition-colors duration-200",
							isDirty ? "bg-subtle" : "bg-success",
						)}
					/>
					{isDirty ? "Salvando…" : "Salvo automaticamente"}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuItem onClick={() => invokeAction("save-project")}>
					<HugeiconsIcon icon={FloppyDiskIcon} className="size-3.5" />
					Salvar projeto
					<span className="text-muted-foreground ml-auto text-xs">Ctrl+S</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => invokeAction("save-project-as")}>
					Salvar projeto como…
					<span className="text-muted-foreground ml-auto text-xs">Ctrl+Shift+S</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function HistoryControls() {
	const editor = useEditor();
	const canUndo = useEditor((e) => e.command.canUndo());
	const canRedo = useEditor((e) => e.command.canRedo());

	return (
		<div className="flex items-center gap-0.5">
			<Button
				variant="ghost"
				size="icon"
				className="size-8 rounded-md"
				disabled={!canUndo}
				onClick={() => editor.command.undo()}
				title="Desfazer (Ctrl+Z)"
			>
				<HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="size-8 rounded-md"
				disabled={!canRedo}
				onClick={() => editor.command.redo()}
				title="Refazer (Ctrl+Shift+Z)"
			>
				<HugeiconsIcon icon={ArrowTurnForwardIcon} className="size-4" />
			</Button>
		</div>
	);
}

// The P logo now works as a direct "go Home" button (was previously a
// dropdown with Exit project/Shortcuts/Discord — Shortcuts moved to
// Configurações, Discord removed, and "Exit project" is just what clicking
// this button already does). Reuses the exact same safe-exit sequence the
// old "Exit project" item used, so no unsaved state is lost going Home.
function HomeButton() {
	const [isExiting, setIsExiting] = useState(false);
	const router = useRouter();
	const editor = useEditor();

	const handleGoHome = async () => {
		if (isExiting) return;
		setIsExiting(true);

		try {
			await editor.project.prepareExit();
		} catch (error) {
			console.error("Failed to prepare project exit:", error);
		} finally {
			editor.project.closeProject();
			router.push("/projects");
		}
	};

	return (
		<Button
			variant="ghost"
			size="icon"
			className="p-1 rounded-sm size-8"
			onClick={handleGoHome}
			disabled={isExiting}
			title="Voltar para a Home do PronixCut"
		>
			<Image
				src="/logos/pronix-p.png"
				alt="PronixCut"
				width={32}
				height={32}
				className="size-5 object-contain"
			/>
		</Button>
	);
}

function EditableProjectName() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const originalNameRef = useRef("");

	const projectName = activeProject?.metadata.name || "";

	const startEditing = () => {
		if (isEditing) return;
		originalNameRef.current = projectName;
		setIsEditing(true);

		requestAnimationFrame(() => {
			inputRef.current?.select();
		});
	};

	const saveEdit = async () => {
		if (!inputRef.current || !activeProject) return;
		const newName = inputRef.current.value.trim();
		setIsEditing(false);

		if (!newName) {
			inputRef.current.value = originalNameRef.current;
			return;
		}

		if (newName !== originalNameRef.current) {
			try {
				await editor.project.renameProject({
					id: activeProject.metadata.id,
					name: newName,
				});
			} catch (error) {
				toast.error("Falha ao renomear projeto", {
					description:
						error instanceof Error ? error.message : "Tente novamente",
				});
			}
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			inputRef.current?.blur();
		} else if (event.key === "Escape") {
			event.preventDefault();
			if (inputRef.current) {
				inputRef.current.value = originalNameRef.current;
				inputRef.current.setSelectionRange(0, 0);
			}
			setIsEditing(false);
			inputRef.current?.blur();
		}
	};

	return (
		<input
			ref={inputRef}
			type="text"
			defaultValue={projectName}
			readOnly={!isEditing}
			onClick={startEditing}
			onBlur={saveEdit}
			onKeyDown={handleKeyDown}
			style={{ fieldSizing: "content" }}
			className={cn(
				"text-[0.9rem] h-8 px-2 py-1 rounded-sm bg-transparent outline-none cursor-pointer hover:bg-accent hover:text-accent-foreground",
				isEditing && "ring-1 ring-ring cursor-text hover:bg-transparent",
			)}
		/>
	);
}
