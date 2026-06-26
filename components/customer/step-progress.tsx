"use client";

import { motion } from "framer-motion";

interface StepProgressProps {
  currentStep: number;
  steps: string[];
  onStepClick?: (step: number) => void;
  maxWidthClassName?: string;
}

export function StepProgress({
  currentStep,
  steps,
  onStepClick,
  maxWidthClassName = "",
}: StepProgressProps) {
  return (
    <div className={`flex items-start px-4 pt-[10px] pb-3 ${maxWidthClassName}`}>
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum <= currentStep;
        const isCurrent = stepNum === currentStep;
        const isClickable = onStepClick && stepNum < currentStep;

        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(stepNum)}
              className={`flex flex-col items-center flex-none ${isClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <motion.div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isActive
                    ? "bg-amber-400 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
                initial={false}
                animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {stepNum}
              </motion.div>
              <span
                className={`text-[11px] mt-1 whitespace-nowrap ${
                  isActive ? "text-gray-900 font-medium" : "text-gray-600"
                }`}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-0.875rem] ${
                  stepNum < currentStep ? "bg-amber-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
