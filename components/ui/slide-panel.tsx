"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onDelete?: () => void;
  children: React.ReactNode;
}

export function SlidePanel({ open, onClose, title, onDelete, children }: SlidePanelProps) {
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [mobileMaxHeight, setMobileMaxHeight] = useState("75vh");

  // Detect mobile
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Adjust height when mobile keyboard opens (visualViewport shrinks)
  useEffect(() => {
    if (!open || !isMobile) return;
    const vv = window.visualViewport;
    if (!vv) return;

    function onResize() {
      if (!vv) return;
      // Use almost all of the visual viewport so the form is fully visible above the keyboard
      const h = vv.height;
      setMobileMaxHeight(`${h - 16}px`);
    }

    // Set initial value
    onResize();

    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [open, isMobile]);

  // Scroll focused input into view inside the panel body when keyboard opens
  useEffect(() => {
    if (!open || !isMobile) return;
    function onFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement;
      if (!bodyRef.current?.contains(target)) return;
      // Small delay lets the keyboard finish animating
      setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 150);
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open, isMobile]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  // Mobile drag-to-dismiss handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setDragOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragOffset(delta);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragOffset > 100) {
      onClose();
    }
    setDragOffset(0);
    dragStartY.current = null;
  }, [dragOffset, onClose]);

  function handleDelete() {
    if (!onDelete) return;
    if (confirm("Are you sure you want to delete this?")) {
      onDelete();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      {isMobile ? (
        /* Mobile: bottom sheet */
        <div
          ref={panelRef}
          className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-lg flex flex-col transition-[transform,max-height] duration-200 ease-out"
          style={{
            maxHeight: mobileMaxHeight,
            transform: `translateY(${dragOffset}px)`,
          }}
        >
          {/* Drag handle */}
          <div
            className="flex justify-center pt-3 pb-1 cursor-grab"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-4 pb-3 pt-1 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">{title}</span>
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="h-7 w-7 rounded-md border grid place-items-center text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-md border grid place-items-center text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-4">
            {children}
          </div>
        </div>
      ) : (
        /* Desktop: right slide */
        <div
          ref={panelRef}
          className="absolute top-0 right-0 h-full w-[380px] bg-card border-l shadow-lg flex flex-col animate-in slide-in-from-right duration-200"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
            <span className="text-sm font-semibold">{title}</span>
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="h-7 w-7 rounded-md border grid place-items-center text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-md border grid place-items-center text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
