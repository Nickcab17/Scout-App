export default function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 3.5 33.5 11.25v15.5L20 34.5 6.5 26.75v-15.5L20 3.5Z" stroke="currentColor" strokeWidth="2.2" />
      <path d="m20 11 7.5 4.3v8.6L20 28.2l-7.5-4.3v-8.6L20 11Z" fill="currentColor" fillOpacity=".22" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 3.5v7.2m13.5.55-6.2 3.6M33.5 26.75l-6.2-3.6M20 34.5v-6.3M6.5 26.75l6.2-3.6M6.5 11.25l6.2 3.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
