import logo from "../../assets/logo.png";

export default function AuthLayout({ heading, subtext, sideExtra, children }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl shadow-purple-900/30 border border-purple-900/30">
        {/* Left branding panel */}
        <div className="relative bg-gradient-to-br from-purple-950 via-purple-950/80 to-black p-10 flex flex-col justify-between min-h-[520px]">
          <div className="flex items-center gap-3">
            <img src={logo} alt="PNX AI" className="w-10 h-10 rounded-lg" />
            <div>
              <p className="font-serif text-lg font-bold text-purple-300 leading-tight">
                PNX AI
              </p>
              <p className="text-xs text-gray-400">Agentic Intelligence</p>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-white">{heading}</h1>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              {subtext}
            </p>
            {sideExtra}
          </div>

          <p className="text-xs text-gray-600">
            © 2026 PNX AI Inc. All rights reserved.
          </p>
        </div>

        {/* Right form panel */}
        <div className="bg-black p-10 flex flex-col justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}
