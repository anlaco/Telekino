# TCP API — Referencia de Red

> Integrado en binarios `red-cli` y `red-view` desde fork `anlaco/red` (Fase 4+)

## API de bajo nivel

El objeto `tcp` expone una API nativa de sockets TCP para comunicación red.

### Funciones principales

#### `tcp/connect host port → logic!`

Conecta a un servidor TCP.

```red
if tcp/connect "192.168.1.100" 5025 [
    print "Conectado a instrumento"
] [
    print "Error de conexión"
]
```

- **host** `[string!]` — dirección IP o nombre de host
- **port** `[integer!]` — puerto TCP (1-65535)
- **return** `[logic!]` — true si éxito, false si fallo

#### `tcp/send data → logic!`

Envía datos al servidor.

```red
tcp/send "GET / HTTP/1.0^/^/"   ; texto
tcp/send to-binary! "datos"     ; bytes
```

- **data** `[string! binary!]` — datos a enviar
- **return** `[logic!]` — true si enviado, false si error

#### `tcp/receive size → binary! | none!`

Recibe datos del servidor (bloqueante).

```red
response: tcp/receive 1024
if response [
    print to-string! response
]
```

- **size** `[integer!]` — máximo bytes a recibir
- **return** `[binary! none!]` — datos recibidos o none si error/desconectado

#### `tcp/close → logic!`

Cierra la conexión.

```red
tcp/close
```

- **return** `[logic!]` — true siempre

### Estado y opciones

#### `tcp/connected? → logic!`

Estado actual de la conexión.

```red
if tcp/connected? [
    print "Conectado"
]
```

#### `tcp/set-timeout ms → logic!`

Timeout para receive (milisegundos).

```red
tcp/set-timeout 5000   ; esperar max 5 segundos
data: tcp/receive 256
```

#### `tcp/readable? → logic!`

Verifica si hay datos disponibles sin bloquear.

```red
if tcp/readable? [
    data: tcp/receive 256
]
```

#### `tcp/receive-available size → binary! | none!`

Recibe datos disponibles sin bloquear.

```red
data: tcp/receive-available 256  ; no bloquea
```

#### `tcp/set-nonblocking enable → logic!`

Modo no-bloqueante (avanzado).

```red
tcp/set-nonblocking true
```

#### `tcp/last-error → object!`

Obtiene último error.

```red
error: tcp/last-error
print error/message
```

## Casos de uso — Fase 4

### Eco genérico (cliente TCP)

```red
Red [Needs: 'View]

; Conectar a servidor
if not tcp/connect "192.168.1.100" 5000 [
    print "Error: no se pudo conectar"
    halt
]

; Enviar petición
tcp/send "PING^/"

; Leer respuesta
response: tcp/receive 256
print ["Respuesta: " to-string! response]

; Cerrar
tcp/close
```

> Para enviar comandos de instrumentación (texto plano como `*IDN?`, `MEAS:VOLT?`,
> cadenas Modbus, etc.) basta con poner el string adecuado en `tcp/send`. QTorres no
> incluye bloques específicos por protocolo — el usuario elige qué cadena enviar.

### Lectura secuencial (con timeout)

```red
tcp/set-timeout 2000

loop 10 [
    data: tcp/receive 64
    if data [
        print ["Dato " index ": " to-string! data]
    ]
]

tcp/close
```

### Polling no-bloqueante

```red
tcp/set-nonblocking true

loop 100 [
    if tcp/readable? [
        data: tcp/receive 256
        process-data data
    ]
    wait 0.01  ; evitar busy-loop
]

tcp/close
```

## Notas de implementación

- **Bloqueante por defecto:** `tcp/receive` bloquea hasta recibir datos o timeout
- **Terminación de línea:** muchos protocolos de texto requieren `\n` o `\r\n` al final de cada mensaje — usar `rejoin [cmd newline]`
- **Binary vs String:** TCP transporta bytes. Convertir con `to-string!` / `to-binary!` cuando el protocolo sea texto
- **Sin hilos:** Red no tiene multihilo. Para múltiples conexiones, usar polling no-bloqueante + `on-time` / timers (DT-027)
- **Error handling:** revisar `tcp/last-error` si `connect` o `send` fallan

## Integración QTorres (Fase 4)

Los bloques de hardware (#19, #22) usarán esta API de forma genérica:

- **tcp-connect / tcp-write / tcp-read / tcp-close** → wrappers directos de `tcp/connect`, `tcp/send`, `tcp/receive`, `tcp/close`
- **Error cluster** → `tcp/last-error` mapea a puertos error-in/error-out
- **Timeout configurable** → parámetro de bloque → `tcp/set-timeout`
- **Modbus TCP** (#22) → syntactic sugar que construye la trama Modbus y la envía con `tcp/send`

> QTorres no incluye bloques específicos por protocolo (HTTP, SCPI, MQTT, …). Cada
> protocolo de texto se usa pasando la cadena adecuada al bloque `tcp-write`.
> Protocolos binarios (Modbus, custom) pueden construirse con `to-binary!`.

Ver `docs/plan.md` — Fase 4 para roadmap completo.
