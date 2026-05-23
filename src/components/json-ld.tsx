// Renderiza JSON-LD inline. Server-friendly (sem useEffect/JS no client).
// Aceita 1 ou N objetos — pra evitar repetir <script> em cada página.

interface Props {
  data: object | object[]
}

export function JsonLd({ data }: Props) {
  const items = Array.isArray(data) ? data : [data]
  return (
    <>
      {items.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }}
        />
      ))}
    </>
  )
}
