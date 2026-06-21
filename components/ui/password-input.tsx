"use client";

import { forwardRef, useState, InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  leftIcon?: React.ReactNode;
};

export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  function PasswordInput({ className, leftIcon, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative w-full">
        {leftIcon}
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={className}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-600"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    );
  },
);
