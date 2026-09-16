"use client";

import { useMemo, useRef, useState } from "react";
import {
	addCurvePoint,
	moveCurvePoint,
	removeCurvePoint,
	sampleCurveToLut,
	type CurvePoint,
} from "@/effects/color-grade/curve-math";
import { cn } from "@/utils/ui";

const VIEW_SIZE = 240;
const SAMPLE_COUNT = 48;
const GRID_STEPS = 4;

function toSvg(point: CurvePoint): { x: number; y: number } {
	return { x: point.x * VIEW_SIZE, y: (1 - point.y) * VIEW_SIZE };
}

function fromSvg({ x, y }: { x: number; y: number }): CurvePoint {
	return {
		x: Math.min(1, Math.max(0, x / VIEW_SIZE)),
		y: Math.min(1, Math.max(0, 1 - y / VIEW_SIZE)),
	};
}

export function CurveEditor({
	points,
	onChange,
	onCommit,
	color = "#FFC600",
	className,
}: {
	points: CurvePoint[];
	onChange: (points: CurvePoint[]) => void;
	onCommit: () => void;
	color?: string;
	className?: string;
}) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [dragIndex, setDragIndex] = useState<number | null>(null);

	const sorted = useMemo(() => [...points].sort((a, b) => a.x - b.x), [points]);

	const pathD = useMemo(() => {
		const lut = sampleCurveToLut({ points: sorted, size: SAMPLE_COUNT });
		return Array.from(lut)
			.map((y, i) => {
				const x = i / (SAMPLE_COUNT - 1);
				const svg = toSvg({ x, y });
				return `${i === 0 ? "M" : "L"} ${svg.x.toFixed(2)} ${svg.y.toFixed(2)}`;
			})
			.join(" ");
	}, [sorted]);

	const clientToLocal = (event: { clientX: number; clientY: number }) => {
		const rect = svgRef.current?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		return {
			x: ((event.clientX - rect.left) / rect.width) * VIEW_SIZE,
			y: ((event.clientY - rect.top) / rect.height) * VIEW_SIZE,
		};
	};

	const handleBackgroundClick = (event: React.MouseEvent<SVGSVGElement>) => {
		if (dragIndex !== null) return;
		const local = clientToLocal(event);
		const point = fromSvg(local);
		onChange(addCurvePoint({ points: sorted, point }));
		onCommit();
	};

	const handlePointDown = (index: number) => (event: React.PointerEvent) => {
		event.stopPropagation();
		(event.target as Element).setPointerCapture(event.pointerId);
		setDragIndex(index);
	};

	const handlePointMove = (index: number) => (event: React.PointerEvent) => {
		if (dragIndex !== index) return;
		const local = clientToLocal(event);
		const point = fromSvg(local);
		const isEndpoint = index === 0 || index === sorted.length - 1;
		if (!isEndpoint) {
			// Keep the array order stable during the drag (don't let a point
			// cross its neighbors) — moveCurvePoint re-sorts by x, which would
			// otherwise make `index` refer to a different point mid-drag.
			const prevX = sorted[index - 1]?.x ?? 0;
			const nextX = sorted[index + 1]?.x ?? 1;
			const margin = 0.005;
			point.x = Math.min(nextX - margin, Math.max(prevX + margin, point.x));
		}
		onChange(moveCurvePoint({ points: sorted, index, point, isEndpoint }));
	};

	const handlePointUp = () => {
		if (dragIndex !== null) {
			setDragIndex(null);
			onCommit();
		}
	};

	const handlePointDoubleClick = (index: number) => (event: React.MouseEvent) => {
		event.stopPropagation();
		onChange(removeCurvePoint({ points: sorted, index }));
		onCommit();
	};

	const handlePointContextMenu = (index: number) => (event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		onChange(removeCurvePoint({ points: sorted, index }));
		onCommit();
	};

	return (
		<svg
			ref={svgRef}
			viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
			className={cn("bg-accent/40 border-border aspect-square w-full cursor-crosshair rounded-md border select-none", className)}
			onClick={handleBackgroundClick}
		>
			{Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
				const pos = (VIEW_SIZE / GRID_STEPS) * i;
				return (
					<g key={i} className="text-border" stroke="currentColor" strokeWidth={1}>
						<line x1={pos} y1={0} x2={pos} y2={VIEW_SIZE} opacity={0.5} />
						<line x1={0} y1={pos} x2={VIEW_SIZE} y2={pos} opacity={0.5} />
					</g>
				);
			})}

			<path
				d={`M 0 ${VIEW_SIZE} L ${VIEW_SIZE} 0`}
				stroke="currentColor"
				className="text-muted-foreground"
				strokeWidth={1}
				strokeDasharray="3 4"
				opacity={0.4}
				fill="none"
			/>

			<path d={pathD} stroke={color} strokeWidth={2} fill="none" />

			{sorted.map((point, index) => {
				const svg = toSvg(point);
				return (
					<circle
						key={index}
						cx={svg.x}
						cy={svg.y}
						r={5}
						fill="white"
						stroke={color}
						strokeWidth={2}
						className="cursor-grab active:cursor-grabbing"
						onClick={(event) => event.stopPropagation()}
						onPointerDown={handlePointDown(index)}
						onPointerMove={handlePointMove(index)}
						onPointerUp={handlePointUp}
						onDoubleClick={handlePointDoubleClick(index)}
						onContextMenu={handlePointContextMenu(index)}
					/>
				);
			})}
		</svg>
	);
}
