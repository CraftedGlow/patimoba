"use client";

import { motion } from "framer-motion";

interface StepProgressProps {
  currentStep: number;
  steps: string[];
  onStepClick?: (step: number) => void;
}

export function StepProgress({ currentStep, steps, onStepClick }: StepProgressProps) {
  return (
    <div className="flex items-center justify-between px-4 pt-1.5 pb-3">
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
              className={`flex flex-col items-center ${isClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <motion.div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
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
                className={`text-xs mt-1.5 whitespace-nowrap ${
                  isActive ? "text-gray-900 font-medium" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-[6px] mt-[-1rem] ${
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
