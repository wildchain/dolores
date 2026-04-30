// SVG-based protocol diagram: AGENT → VERIFY → RECEIPT → OPERATOR
//                                              ↓
//                                          CHALLENGE

const NODES = [
  { id: "agent", label: "AGENT", x: 80, y: 60 },
  { id: "verify", label: "VERIFY", x: 240, y: 60 },
  { id: "receipt", label: "RECEIPT", x: 400, y: 60 },
  { id: "operator", label: "OPERATOR", x: 560, y: 60 },
  { id: "challenge", label: "CHALLENGE", x: 320, y: 140 },
] as const;

const EDGES: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
}[] = [
  // AGENT → VERIFY
  { x1: 112, y1: 60, x2: 208, y2: 60, dashed: true },
  // VERIFY → RECEIPT
  { x1: 272, y1: 60, x2: 368, y2: 60, dashed: true },
  // RECEIPT → OPERATOR
  { x1: 432, y1: 60, x2: 528, y2: 60, dashed: true },
  // VERIFY ↓ CHALLENGE (vertical leg from VERIFY down)
  { x1: 240, y1: 92, x2: 240, y2: 140, dashed: true },
  // horizontal from VERIFY-x to CHALLENGE-x
  { x1: 240, y1: 140, x2: 288, y2: 140, dashed: true },
];

export function ProtocolGlance() {
  return (
    <section
      id="protocol"
      className="relative z-10 px-8 py-24"
      style={{ background: "var(--surface-raised)" }}
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left — copy */}
        <div>
          <h2
            className="font-bold mb-4"
            style={{
              fontSize: "var(--fs-32)",
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              color: "var(--fg)",
            }}
          >
            The protocol, <span style={{ color: "var(--fg)" }}>at a</span>
            <br />
            glance.
          </h2>
          <p
            style={{
              fontSize: "var(--fs-18)",
              color: "var(--fg-muted)",
              lineHeight: 1.6,
            }}
          >
            Four primitives. One CPI gate.
            <br />
            Every action leaves a trace.
          </p>
        </div>

        {/* Right — diagram */}
        <div className="flex items-center justify-center">
          <svg
            viewBox="0 0 640 200"
            width="100%"
            style={{ maxWidth: 580, overflow: "visible" }}
            aria-label="Protocol flow: Agent, Verify, Receipt, Operator with Challenge branch"
          >
            {/* Edges */}
            {EDGES.map((e, i) => (
              <line
                key={i}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeDasharray={e.dashed ? "5 4" : undefined}
                strokeOpacity={0.5}
              />
            ))}

            {/* Nodes */}
            {NODES.map(n => (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={32}
                  fill="var(--bg)"
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
                <text
                  x={n.x}
                  y={n.y + 52}
                  textAnchor="middle"
                  fill="var(--fg-muted)"
                  style={{
                    fontSize: 11,
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                  }}
                >
                  {n.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
