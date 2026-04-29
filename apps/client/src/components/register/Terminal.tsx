interface TerminalLine {
  text: string;
  cls?: "success" | "cmd" | "info";
}

interface TerminalProps {
  lines: TerminalLine[];
}

export function Terminal({ lines }: TerminalProps) {
  return (
    <div className="terminal mb-5">
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          background: "#171a14",
          borderBottom: "1px solid rgba(174,184,160,0.1)",
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map(c => (
          <div
            key={c}
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="p-4 font-mono text-[12px] leading-relaxed space-y-0.5">
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              color:
                l.cls === "success"
                  ? "#7EC8A0"
                  : l.cls === "cmd"
                    ? "#AEB8A0"
                    : "rgba(174,184,160,0.5)",
            }}
          >
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
