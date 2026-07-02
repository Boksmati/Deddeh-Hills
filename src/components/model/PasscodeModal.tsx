"use client";

import { useState } from "react";

/**
 * In-app passcode prompt. Deliberately avoids window.prompt/alert — native
 * dialogs are blocked or return immediately in sandboxed preview iframes and
 * some embedded browser views, which made the previous implementation
 * silently fail or misfire.
 */
export function PasscodeModal({
  lang, code, onSuccess, onClose,
}: {
  lang: string;
  code: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (value === code) {
      onSuccess();
    } else {
      setError(true);
      setValue("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            {lang === "ar" ? "بيانات خاصة" : "Private insight"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            {lang === "ar" ? "أدخل الرمز لإظهار البيانات الخاصة" : "Enter the passcode to reveal private insight"}
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={value}
            onChange={e => { setValue(e.target.value); setError(false); }}
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
            className={`w-full px-3 py-2 border rounded-lg text-sm tracking-widest text-center focus:outline-none focus:ring-1 focus:ring-dh-hills ${
              error ? "border-red-300 bg-red-50" : "border-gray-200"
            }`}
            placeholder="••••"
          />
          {error && (
            <p className="text-[11px] text-red-600">
              {lang === "ar" ? "رمز غير صحيح" : "Incorrect passcode"}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              onClick={submit}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-dh-dark text-white hover:opacity-90 transition-colors"
            >
              {lang === "ar" ? "تأكيد" : "Unlock"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
