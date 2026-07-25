export default function StepIndicator({ step }) {
  const steps = [
    { id: 1, label: "Sign up your account" },
    { id: 2, label: "Verify OTP" },
  ];

  return (
    <div className="space-y-2 pt-2">
      {steps.map((s) => {
        const isActive = step === s.id;
        const isDone = step > s.id;
        return (
          <div
            key={s.id}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
              isActive ? "bg-white text-black" : "bg-zinc-900 text-gray-400"
            }`}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                isActive
                  ? "bg-black text-white"
                  : isDone
                    ? "bg-purple-600 text-white"
                    : "bg-zinc-700 text-gray-300"
              }`}>
              {isDone ? "✓" : s.id}
            </span>
            {s.label}
          </div>
        );
      })}
    </div>
  );
}
