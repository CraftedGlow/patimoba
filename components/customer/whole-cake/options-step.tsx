"use client";

import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, Cherry, StickyNote, Candy, IceCream2, Tag, type LucideIcon } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import type { WholeCakeProduct, DecorationGroupWithItems } from "@/lib/types";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  fruit: Cherry,
  plate: StickyNote,
  topping: Candy,
  cream: IceCream2,
  other: Tag,
};

interface OptionsStepProps {
  cake: WholeCakeProduct;
  decorationGroups: DecorationGroupWithItems[];
  groupsLoading: boolean;
  selectedDecorations: Record<string, string[]>;
  onDecorationsChange: (d: Record<string, string[]>) => void;
  plateMessages: Record<string, string>;
  onPlateMessagesChange: (messages: Record<string, string>) => void;
  total: number;
  hasRequiredUnfilled: boolean;
  excludeGroupIds?: string[];
  onNext: () => void;
}

export function WholeCakeOptionsStep({
  cake,
  decorationGroups,
  groupsLoading,
  selectedDecorations,
  onDecorationsChange,
  plateMessages,
  onPlateMessagesChange,
  total,
  hasRequiredUnfilled,
  excludeGroupIds,
  onNext,
}: OptionsStepProps) {
  const visibleGroups = excludeGroupIds?.length
    ? decorationGroups.filter((g) => !excludeGroupIds.includes(g.id))
    : decorationGroups;

  // 選択済みデコレーションが除外するカテゴリー（例: プリント選択でプレートを除外）と、その理由（どの項目のせいか）
  const excludedCategoryReasons = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const group of decorationGroups) {
      const selectedIds = selectedDecorations[group.id] ?? [];
      for (const item of group.items) {
        if (!selectedIds.includes(item.id)) continue;
        for (const c of item.excludesCategories) {
          const names = map.get(c) ?? [];
          names.push(item.name);
          map.set(c, names);
        }
      }
    }
    return map;
  }, [decorationGroups, selectedDecorations]);

  // 除外対象になったカテゴリーの選択済みデコレーションは自動的に解除する
  useEffect(() => {
    if (excludedCategoryReasons.size === 0) return;
    let changed = false;
    const next = { ...selectedDecorations };
    for (const group of decorationGroups) {
      const selectedIds = next[group.id] ?? [];
      const filtered = selectedIds.filter((id) => {
        const item = group.items.find((i) => i.id === id);
        return !item || !excludedCategoryReasons.has(item.category);
      });
      if (filtered.length !== selectedIds.length) {
        next[group.id] = filtered;
        changed = true;
      }
    }
    if (changed) onDecorationsChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludedCategoryReasons]);

  const handleSelect = (groupId: string, decorationId: string, group: DecorationGroupWithItems) => {
    const current = selectedDecorations[groupId] ?? [];

    if (group.selectionType === "single") {
      // 単一選択：すでに選択済みなら解除、そうでなければ置き換え
      const next = current.includes(decorationId) ? [] : [decorationId];
      onDecorationsChange({ ...selectedDecorations, [groupId]: next });
    } else {
      // 複数選択
      if (current.includes(decorationId)) {
        onDecorationsChange({ ...selectedDecorations, [groupId]: current.filter((id) => id !== decorationId) });
      } else {
        const max = group.maxSelections;
        if (max && current.length >= max) return; // 上限超えは無視
        onDecorationsChange({ ...selectedDecorations, [groupId]: [...current, decorationId] });
      }
    }
  };

  const isAtMax = (group: DecorationGroupWithItems): boolean => {
    if (group.selectionType !== "multiple" || !group.maxSelections) return false;
    return (selectedDecorations[group.id] ?? []).length >= group.maxSelections;
  };

  return (
    <div className="px-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold">デコレーション</h2>
        <div className="flex items-baseline gap-1">
          <span className="text-sm text-gray-500">合計</span>
          <span className="text-2xl font-bold">{total.toLocaleString()}</span>
          <span className="text-base">円</span>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
            <img src={cake.image} alt={cake.name} className="w-full h-full object-cover" />
          </div>
          <h3 className="text-lg font-bold">{cake.name}</h3>
        </div>

        {groupsLoading ? (
          <div className="flex items-center justify-center py-12">
            <LineSpinner size={20} />
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-600">
            このケーキにはデコレーションオプションがありません
          </div>
        ) : (
          <div className="space-y-6 mb-8">
            {visibleGroups.map((group) => {
              const selected = selectedDecorations[group.id] ?? [];
              const atMax = isAtMax(group);

              return (
                <div key={group.id}>
                  {/* グループヘッダー */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-bold">{group.name}</span>
                    {group.required ? (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">必須</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">任意</span>
                    )}
                    {group.selectionType === "single" ? (
                      <span className="text-xs text-gray-600">どれか1つ</span>
                    ) : (
                      <span className="text-xs text-gray-600">
                        複数選択{group.maxSelections ? `（最大${group.maxSelections}個）` : ""}
                      </span>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-xs text-gray-500 mb-3">{group.description}</p>
                  )}

                  {/* 除外中の注記 */}
                  {group.items.some((deco) => !selected.includes(deco.id) && excludedCategoryReasons.has(deco.category)) && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 mb-3">
                      「{Array.from(new Set(group.items.flatMap((deco) => excludedCategoryReasons.get(deco.category) ?? []))).join("・")}」を選択中のため、一部の項目は選択できません
                    </p>
                  )}

                  {/* デコレーションカードグリッド */}
                  <div className="grid grid-cols-3 gap-2">
                    {group.items.map((deco) => {
                      const isSelected = selected.includes(deco.id);
                      const isExcluded = !isSelected && excludedCategoryReasons.has(deco.category);
                      const isDisabled = (!isSelected && atMax) || isExcluded;

                      return (
                        <motion.button
                          key={deco.id}
                          type="button"
                          whileTap={isDisabled ? undefined : { scale: 0.95 }}
                          onClick={() => !isDisabled && handleSelect(group.id, deco.id, group)}
                          disabled={isDisabled}
                          className={`relative rounded-xl overflow-hidden border-2 text-left transition-colors ${
                            isSelected
                              ? "border-amber-400 bg-amber-50"
                              : isDisabled
                              ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                              : "border-gray-200 bg-white hover:border-amber-200 hover:bg-amber-50/30"
                          }`}
                        >
                          {/* 画像 */}
                          <div className={`w-full aspect-[1/0.98] flex items-center justify-center overflow-hidden ${(deco.imageUrl || deco.category === "print") ? "bg-gray-100" : "bg-white"}`}>
                            {deco.imageUrl ? (
                              <img
                                src={deco.imageUrl}
                                alt={deco.name}
                                className="w-full h-full object-cover"
                              />
                            ) : deco.category === "print" ? (
                              <img
                                src="/print-decoration-option-default.jpg"
                                alt={deco.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (() => {
                                const Icon = CATEGORY_ICON[deco.category] ?? Tag;
                                return <Icon className="w-8 h-8 text-gray-600" strokeWidth={1.5} />;
                              })()
                            )}
                          </div>

                          {/* 選択済みチェック */}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}

                          {/* テキスト */}
                          <div className="p-2">
                            <p className="text-xs font-bold leading-tight line-clamp-2">{deco.name}</p>
                            <p className={`text-xs mt-0.5 font-medium ${deco.price === 0 ? "text-green-600" : "text-amber-600"}`}>
                              {deco.price === 0 ? "無料" : `+¥${deco.price.toLocaleString()}`}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* プレート選択時のメッセージ入力 */}
                  {group.items
                    .filter((deco) => selected.includes(deco.id) && deco.category === "plate")
                    .map((deco) => (
                      <div key={`msg-${deco.id}`} className="mt-3">
                        <label className="text-xs font-bold text-gray-600 mb-1 block">
                          プレートに書くメッセージ
                        </label>
                        <input
                          type="text"
                          value={plateMessages[deco.id] ?? ""}
                          onChange={(e) =>
                            onPlateMessagesChange({ ...plateMessages, [deco.id]: e.target.value })
                          }
                          placeholder="例：Happy Birthday!"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-400"
                        />
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        )}

        {/* 必須未選択の警告 */}
        {hasRequiredUnfilled && (
          <p className="text-xs text-red-500 text-center mb-4">
            必須のデコレーションを選択してください
          </p>
        )}

        <div className="flex justify-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNext}
            disabled={hasRequiredUnfilled}
            className="px-10 py-3.5 rounded-full font-bold text-base bg-amber-400 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            確認に進む
          </motion.button>
        </div>
      </div>
    </div>
  );
}
