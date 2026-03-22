interface Props {
  text?: string;
}

export function LoadingSpinner({ text = 'Ładowanie...' }: Props) {
  return (
    <div className="text-white/50 animate-pulse text-center mt-20">{text}</div>
  );
}
