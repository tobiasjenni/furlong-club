export function LandingScenarioChart() {
  const days = Array.from({ length: 16 }, (_, day) => day);
  const x = (day: number) => 37 + day / 15 * 378;
  const y = (percent: number) => 150 - percent / 90 * 132;
  const scenarios = [
    { rate: 2, color: "#e7c77b", label: "+2% daily assumption" },
    { rate: 4, color: "#87d7b0", label: "+4% daily assumption" },
    { rate: -2, color: "#f0a29c", label: "−2% daily loss example" },
  ];
  return <section className="landing-scenario" aria-label="Hypothetical 15-day scenarios, not trading history">
    <div className="landing-scenario-heading"><strong>15-day illustration</strong><span>NOT ACTUAL RESULTS</span></div>
    <p className="landing-scenario-subtitle">Different assumptions. Different outcomes.</p>
    <svg viewBox="0 0 450 222" role="img" aria-label="Hypothetical cumulative percentage change over 15 days, without compounding. Assuming plus 2 percent a day gives plus 30 percent; plus 4 percent gives plus 60 percent; minus 2 percent gives minus 30 percent. These are arithmetic examples, not historical returns or a forecast.">
      {[-30, 0, 30, 60].map(value => <g key={value}><line x1="37" x2="415" y1={y(value)} y2={y(value)} stroke={value === 0 ? "#b9cbbd55" : "#b9cbbd18"} strokeDasharray={value === 0 ? undefined : "3 5"} /><text x="29" y={y(value) + 3} textAnchor="end" fill="#9eb4a5" fontSize="9">{value > 0 ? "+" : ""}{value}%</text></g>)}
      {scenarios.map(s => <g key={s.rate}><path d={days.map(day => `${day === 0 ? "M" : "L"}${x(day)} ${y(day * s.rate)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.rate < 0 ? "4 4" : undefined} /><circle cx={x(15)} cy={y(15 * s.rate)} r="3" fill={s.color} /></g>)}
      {[0, 5, 10, 15].map(day => <text key={day} x={x(day)} y="211" textAnchor="middle" fill="#9eb4a5" fontSize="9">Day {day}</text>)}
    </svg>
    <div className="landing-scenario-legend">{scenarios.map(s => <span key={s.rate}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    <p className="landing-scenario-risk">Illustration only, not a forecast or trading history. Fixed daily assumptions; no compounding, fees or interruptions. Actual results vary and all capital can be lost.</p>
    <details><summary>See the calculation</summary><p>Simple cumulative change = assumed daily percentage × days. These examples do not use Rob’s trading records and do not imply that a target is achievable.</p><div className="landing-scenario-table"><table><caption>Hypothetical cumulative change, without compounding</caption><thead><tr><th>Day</th><th>+2% / day</th><th>+4% / day</th><th>−2% / day</th></tr></thead><tbody>{days.map(day => <tr key={day}><td>{day}</td><td>+{day * 2}%</td><td>+{day * 4}%</td><td>{day ? "−" : ""}{day * 2}%</td></tr>)}</tbody></table></div></details>
  </section>;
}
