/**
 * KJ monogram. The J is the exact path from KJ Marketing Sweden's logo file
 * (logo-02.svg), transformed into viewBox space; the left slab (K stem) is a
 * close hand-trace pending the slab source file.
 */
export function LogoMark({ className = "", size = 26 }: { className?: string; size?: number }) {
  const id = "kj-grad";
  return (
    <svg
      viewBox="212 248 1272 1286"
      width={size}
      height={size * (1286 / 1272)}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="250" y1="280" x2="1420" y2="1500" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d18fe4" />
          <stop offset="0.45" stopColor="#8778ea" />
          <stop offset="1" stopColor="#1f63ee" />
        </linearGradient>
      </defs>
      <path d="M305 295 L460 295 L385 1445 L230 1445 Z" fill={`url(#${id})`} />
      <path
        d="M1383 344.7 C1340.3 388 1262 467.8 1209 522 C1156 576.2 1103.3 630 1091.8 641.5 L1071.1 662.5 L977.9 859 C871.6 1083.4 876.5 1073 878.3 1071 C879.1 1070.2 935 1011 1002.6 939.6 C1070.2 868.1 1166.8 766 1217.3 712.6 C1267.8 659.2 1311.7 613 1314.7 610 L1320.2 604.5 L1319.5 879 C1319.1 1040.9 1318.5 1158.8 1317.9 1166.5 C1312.5 1238 1269.1 1302.8 1205.2 1334.5 C1186.6 1343.7 1168.8 1349.5 1146.5 1353.6 C1132.4 1356.2 1090.9 1356.2 1077 1353.7 C1035.4 1346 1000.4 1329.8 970 1304.2 C952.1 1289.2 925.1 1260.9 899.1 1230.2 C893.4 1223.5 888.4 1218 887.9 1218 C886.9 1218 790.6 1301.7 790.2 1303 C789.6 1304.7 830.5 1357.3 847.6 1376.5 C881.6 1414.9 915.8 1441.9 957.2 1462.6 C1028.4 1498.3 1113.9 1508.6 1192 1490.8 C1330.5 1459.3 1436.2 1340.7 1454.4 1196.3 C1455.4 1188.9 1457 1155.2 1458.5 1111.3 L1461 1038.5 L1460.8 652.2 L1460.5 265.8 L1383 344.7 Z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={24} />
      <span
        className="text-[19px] font-bold tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-display), system-ui, sans-serif" }}
      >
        KJ Studio
      </span>
    </span>
  );
}
