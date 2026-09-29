fn main() {
    if let Err(error) = tk_ui::ejecutar() {
        eprintln!("telekino: {error}");
        std::process::exit(1);
    }
}
