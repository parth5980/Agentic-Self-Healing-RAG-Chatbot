import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput({
  label,
  name,
  value,
  onChange,
  helperText,
  ...props
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      {label && (
        <label className="block text-sm text-gray-300 mb-1.5">{label}</label>
      )}
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          placeholder="********"
          className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-300">
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </div>
  );
}
