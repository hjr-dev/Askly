// Marca de Askly "Molécula": grafo de tres nodos unidos en triángulo, sin
// contenedor. Se lee como molécula (ciencia) y como grafo de nodos
// (programación/redes/IA). Con animated=true, los nodos pulsan en secuencia
// (superior → inferior-izq → inferior-dcha) como una señal recorriendo el
// grafo — se usa en el indicador "Pensando..." del chat mientras responde.
const NODES = [
  { cx: 17, cy: 8, fill: "#5EEAD4", delay: "0s" },
  { cx: 8, cy: 25, fill: "#2DD4BF", delay: "0.2s" },
  { cx: 26, cy: 25, fill: "#2DD4BF", delay: "0.4s" },
];

export default function Logo({ size = 20, animated = false, mono = false, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M17 8 L8 25 M17 8 L26 25 M8 25 H26"
        stroke={mono ? "currentColor" : "#2DD4BF"}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {NODES.map((node, i) => (
        <circle
          key={i}
          cx={node.cx}
          cy={node.cy}
          r={4.5}
          fill={mono ? "currentColor" : node.fill}
          className={animated ? "motion-safe:animate-[askly-node-pulse_1.2s_ease-in-out_infinite]" : ""}
          style={
            animated
              ? { transformBox: "fill-box", transformOrigin: "center", animationDelay: node.delay }
              : undefined
          }
        />
      ))}
    </svg>
  );
}
