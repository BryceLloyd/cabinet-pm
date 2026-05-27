"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus } from "lucide-react";
import { CARD_REGISTRY, ALL_CARD_TYPES } from "@/lib/dashboard/card-registry";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCardTypes: string[];
  onAdd: (cardType: string) => void;
}

export function AddCardDialog({ open, onOpenChange, activeCardTypes, onAdd }: Props) {
  const available = ALL_CARD_TYPES.filter((t) => !activeCardTypes.includes(t));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-in fade-in-0" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-lg border bg-background p-5 shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold">Add card</Dialog.Title>
            <Dialog.Close className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted">
              <X size={16} />
            </Dialog.Close>
          </div>

          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">All cards are already on your dashboard.</p>
          ) : (
            <ul className="space-y-1">
              {available.map((type) => {
                const def = CARD_REGISTRY[type];
                return (
                  <li key={type}>
                    <button
                      onClick={() => onAdd(type)}
                      className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted transition-colors flex items-center gap-3"
                    >
                      <Plus size={16} className="text-muted-foreground shrink-0" />
                      <div>
                        <div className="text-sm font-medium">{def.title}</div>
                        <div className="text-xs text-muted-foreground">{def.description}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
