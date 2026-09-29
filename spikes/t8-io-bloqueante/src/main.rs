// T8 — ¿congela la interfaz una llamada al host bloqueada?
//
// Simula el caso real: tcp_read esperando a un instrumento apagado, invocado
// desde el modulo wasm, con un bucle de frames de 60 fps al lado.
//
// El hilo "UI" mide cuanto tarda cada frame. Si algun frame se pasa del
// presupuesto, la interfaz se ha congelado.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use wasmtime::*;

const WAT: &str = r#"
(module
  (import "tk" "tcp_read" (func $tcp_read (param i32) (result i32)))
  (func (export "run") (result i32)
    (call $tcp_read (i32.const 3000)))
)"#;

const FRAME: Duration = Duration::from_millis(16);
const PRESUPUESTO_MS: u128 = 50;

struct Ui {
    peor_frame_ms: u128,
    frames: u32,
}

fn bucle_ui(activo: &AtomicBool) -> Ui {
    let mut peor = 0u128;
    let mut frames = 0;
    while activo.load(Ordering::Relaxed) {
        let t = Instant::now();
        std::thread::sleep(FRAME);
        peor = peor.max(t.elapsed().as_millis());
        frames += 1;
    }
    Ui { peor_frame_ms: peor, frames }
}

fn modulo(engine: &Engine) -> Result<Module> {
    Module::new(engine, wat::parse_str(WAT)?)
}

// T8a: todo en el mismo hilo — lo que propone el plan actual.
fn t8a_mismo_hilo() -> Result<()> {
    let mut cfg = Config::new();
    cfg.epoch_interruption(true);
    let engine = Engine::new(&cfg)?;
    let module = modulo(&engine)?;
    let mut store = Store::new(&engine, ());
    store.set_epoch_deadline(1);

    let mut linker = Linker::new(&engine);
    linker.func_wrap("tk", "tcp_read", |_: Caller<'_, ()>, ms: i32| -> i32 {
        std::thread::sleep(Duration::from_millis(ms as u64));
        0
    })?;

    let e = engine.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(300));
        e.increment_epoch();
    });

    let inst = linker.instantiate(&mut store, &module)?;
    let run = inst.get_typed_func::<(), i32>(&mut store, "run")?;
    let t = Instant::now();
    let r = run.call(&mut store, ());
    let ms = t.elapsed().as_millis();

    println!("T8a  mismo hilo, Stop (epoch) a los 300 ms");
    println!("     resultado: {}", if r.is_ok() { "termino normal" } else { "interrumpido" });
    println!("     tardo {ms} ms   (el read pedia 3000)");
    println!("     -> epoch {} interrumpe la llamada al host\n",
        if ms < 1000 { "SI" } else { "NO" });
    Ok(())
}

// T8b: VI en hilo trabajador, host NO cancelable.
fn t8b_hilo_trabajador() -> Result<()> {
    let activo = Arc::new(AtomicBool::new(true));
    let a = activo.clone();
    let trabajador = std::thread::spawn(move || -> Result<u128> {
        let engine = Engine::default();
        let module = modulo(&engine)?;
        let mut store = Store::new(&engine, ());
        let mut linker = Linker::new(&engine);
        linker.func_wrap("tk", "tcp_read", |_: Caller<'_, ()>, ms: i32| -> i32 {
            std::thread::sleep(Duration::from_millis(ms as u64));
            0
        })?;
        let inst = linker.instantiate(&mut store, &module)?;
        let run = inst.get_typed_func::<(), i32>(&mut store, "run")?;
        let t = Instant::now();
        let _ = run.call(&mut store, ());
        let ms = t.elapsed().as_millis();
        a.store(false, Ordering::Relaxed);
        Ok(ms)
    });

    let ui = bucle_ui(&activo);
    let ms = trabajador.join().unwrap()?;

    println!("T8b  VI en hilo trabajador, host NO cancelable");
    println!("     peor frame: {} ms   ({} frames)", ui.peor_frame_ms, ui.frames);
    println!("     el read tardo {ms} ms");
    println!("     -> la UI {} durante la operacion bloqueante\n",
        if ui.peor_frame_ms < PRESUPUESTO_MS { "SIGUE VIVA" } else { "SE CONGELA" });
    Ok(())
}

// T8c: hilo trabajador + host cancelable a trozos.
fn t8c_host_cancelable() -> Result<()> {
    let activo = Arc::new(AtomicBool::new(true));
    let cancelar = Arc::new(AtomicBool::new(false));

    let a = activo.clone();
    let c = cancelar.clone();
    let trabajador = std::thread::spawn(move || -> Result<(u128, bool)> {
        let engine = Engine::default();
        let module = modulo(&engine)?;
        let mut store = Store::new(&engine, ());
        let mut linker = Linker::new(&engine);
        linker.func_wrap("tk", "tcp_read", move |_: Caller<'_, ()>, ms: i32| -> i32 {
            // Un import bloqueante debe implementarse a trozos, comprobando
            // la cancelacion. Con un socket real: set_read_timeout(20ms) + reintentar.
            let fin = Instant::now() + Duration::from_millis(ms as u64);
            while Instant::now() < fin {
                if c.load(Ordering::Relaxed) {
                    return -1;
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            0
        })?;
        let inst = linker.instantiate(&mut store, &module)?;
        let run = inst.get_typed_func::<(), i32>(&mut store, "run")?;
        let t = Instant::now();
        let r = run.call(&mut store, ())?;
        let ms = t.elapsed().as_millis();
        a.store(false, Ordering::Relaxed);
        Ok((ms, r == -1))
    });

    let c2 = cancelar.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(300));
        c2.store(true, Ordering::Relaxed);
    });

    let ui = bucle_ui(&activo);
    let (ms, cancelado) = trabajador.join().unwrap()?;

    println!("T8c  hilo trabajador + host CANCELABLE, Stop a los 300 ms");
    println!("     peor frame: {} ms   ({} frames)", ui.peor_frame_ms, ui.frames);
    println!("     el read tardo {ms} ms   (pedia 3000), cancelado limpiamente: {cancelado}");
    println!("     -> UI {} y Stop {}\n",
        if ui.peor_frame_ms < PRESUPUESTO_MS { "VIVA" } else { "CONGELADA" },
        if ms < 1000 { "FUNCIONA" } else { "NO FUNCIONA" });
    Ok(())
}

// T8d: el bucle infinito del guest debe seguir parandose con epoch.
fn t8d_epoch_sigue_valiendo() -> Result<()> {
    let mut cfg = Config::new();
    cfg.epoch_interruption(true);
    let engine = Engine::new(&cfg)?;
    let module = Module::new(
        &engine,
        wat::parse_str("(module (func (export \"run\") (loop $l (br $l))))")?,
    )?;
    let mut store = Store::new(&engine, ());
    store.set_epoch_deadline(1);
    let e = engine.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(200));
        e.increment_epoch();
    });
    let inst = Instance::new(&mut store, &module, &[])?;
    let run = inst.get_typed_func::<(), ()>(&mut store, "run")?;
    let t = Instant::now();
    let r = run.call(&mut store, ());
    println!("T8d  bucle infinito en el guest, epoch a los 200 ms");
    println!("     -> {} en {} ms\n",
        if r.is_err() { "ABORTADO" } else { "NO abortado" },
        t.elapsed().as_millis());
    Ok(())
}

fn main() -> Result<()> {
    println!("T8 — I/O bloqueante y capacidad de respuesta de la interfaz");
    println!("presupuesto de frame: {PRESUPUESTO_MS} ms\n");
    t8a_mismo_hilo()?;
    t8b_hilo_trabajador()?;
    t8c_host_cancelable()?;
    t8d_epoch_sigue_valiendo()?;
    Ok(())
}
