//! Servidor HTTP mínimo sobre `std::net`.
//!
//! Deliberadamente sin `axum`/`tokio`: el spike mide el riesgo del *editor*, no
//! el del framework web. Un hilo por conexión sobra para un solo usuario en
//! `127.0.0.1`, y así no se arrastra un runtime asíncrono a una decisión que
//! todavía no está tomada.

use anyhow::{bail, Result};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};

pub struct Request {
    pub method: String,
    pub path: String,
    pub query: String,
    pub body: Vec<u8>,
}

impl Request {
    /// Valor de un parámetro de query string. Sin decodificación de `%XX`: los
    /// nombres de VI del spike son ASCII simple.
    pub fn param(&self, key: &str) -> Option<&str> {
        self.query
            .split('&')
            .filter_map(|kv| kv.split_once('='))
            .find(|(k, _)| *k == key)
            .map(|(_, v)| v)
    }
}

pub struct Response {
    pub status: u16,
    pub content_type: &'static str,
    pub body: Vec<u8>,
}

impl Response {
    pub fn ok(content_type: &'static str, body: impl Into<Vec<u8>>) -> Self {
        Response { status: 200, content_type, body: body.into() }
    }

    pub fn json(value: &serde_json::Value) -> Self {
        Response::ok("application/json; charset=utf-8", value.to_string())
    }

    /// Error como JSON: el editor lo enseña tal cual en el panel de salida.
    pub fn error(status: u16, message: &str) -> Self {
        let body = serde_json::json!({ "ok": false, "error": message });
        Response { status, content_type: "application/json; charset=utf-8", body: body.to_string().into() }
    }

    fn write_to(&self, out: &mut TcpStream) -> std::io::Result<()> {
        let reason = match self.status {
            200 => "OK",
            400 => "Bad Request",
            404 => "Not Found",
            _ => "Internal Server Error",
        };
        write!(
            out,
            "HTTP/1.1 {} {reason}\r\n\
             Content-Type: {}\r\n\
             Content-Length: {}\r\n\
             Cache-Control: no-store\r\n\
             Connection: close\r\n\r\n",
            self.status,
            self.content_type,
            self.body.len()
        )?;
        out.write_all(&self.body)?;
        out.flush()
    }
}

fn parse(stream: &mut TcpStream) -> Result<Request> {
    let mut reader = BufReader::new(stream.try_clone()?);

    let mut line = String::new();
    if reader.read_line(&mut line)? == 0 {
        bail!("conexión vacía");
    }
    let mut parts = line.split_whitespace();
    let method = parts.next().unwrap_or_default().to_string();
    let target = parts.next().unwrap_or("/").to_string();
    let (path, query) = match target.split_once('?') {
        Some((p, q)) => (p.to_string(), q.to_string()),
        None => (target, String::new()),
    };

    let mut length = 0usize;
    loop {
        let mut header = String::new();
        if reader.read_line(&mut header)? == 0 || header.trim().is_empty() {
            break;
        }
        if let Some((k, v)) = header.split_once(':') {
            if k.eq_ignore_ascii_case("content-length") {
                length = v.trim().parse().unwrap_or(0);
            }
        }
    }

    let mut body = vec![0u8; length];
    if length > 0 {
        reader.read_exact(&mut body)?;
    }
    Ok(Request { method, path, query, body })
}

/// Arranca el servidor y bloquea. `handler` corre en un hilo por conexión.
pub fn serve(
    listener: TcpListener,
    handler: impl Fn(Request) -> Response + Send + Sync + 'static,
) -> Result<()> {
    let handler = std::sync::Arc::new(handler);
    for stream in listener.incoming() {
        let Ok(mut stream) = stream else { continue };
        let handler = handler.clone();
        std::thread::spawn(move || {
            let response = match parse(&mut stream) {
                Ok(request) => handler(request),
                Err(e) => Response::error(400, &e.to_string()),
            };
            let _ = response.write_to(&mut stream);
        });
    }
    Ok(())
}
