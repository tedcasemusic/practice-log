import React from 'react'

export function ProgressRing({ value, goal }: { value: number, goal: number }) {
  const size = 160
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(value / Math.max(goal, 1), 1)
  const dash = circumference * clamped

  return (
    <svg width={size} height={size}>
      <circle
        cx={size/2} cy={size/2} r={radius}
        stroke="var(--ice)" strokeWidth={stroke} fill="none"
      />
      <circle
        cx={size/2} cy={size/2} r={radius}
        stroke="var(--blue)" strokeWidth={stroke} fill="none"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x="50%" y="48%" dominantBaseline="middle" textAnchor="middle" style={{fontSize: 28, fontWeight: 800}}>
        {Math.round(value)} min
      </text>
      <text x="50%" y="62%" dominantBaseline="middle" textAnchor="middle" style={{fontSize: 12, opacity: 0.7}}>
        Goal {goal} min
      </text>
    </svg>
  )
}
