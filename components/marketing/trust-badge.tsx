interface TrustBadgeProps {
  icon: React.ReactNode
  text: string
}

export function TrustBadge({ icon, text }: TrustBadgeProps) {
  return (
    <span className="flex items-center">
      {icon}
      <span>{text}</span>
    </span>
  )
}
