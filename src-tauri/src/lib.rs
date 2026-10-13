use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::Manager;
use thiserror::Error;
use toml::Value;

#[derive(Debug, Error)]
enum CommandWizardError {
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    TomlDe(#[from] toml::de::Error),
    #[error(transparent)]
    TomlSer(#[from] toml::ser::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

impl serde::Serialize for CommandWizardError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

type Result<T> = std::result::Result<T, CommandWizardError>;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SchemaTag {
    name: String,
    color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SchemaMetadata {
    #[serde(default)]
    version: String,
    #[serde(default)]
    author: String,
    #[serde(default)]
    source: String,
    #[serde(default)]
    sha_256: String,
    #[serde(default)]
    homepage: String,
    #[serde(default)]
    executable_version: String,
    #[serde(default)]
    last_validated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SchemaParameter {
    name: String,
    #[serde(default = "default_string_type")]
    r#type: String,
    #[serde(default = "default_required")]
    required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SchemaArgument {
    flag: String,
    #[serde(default)]
    long: String,
    #[serde(default)]
    description: String,
    #[serde(default = "default_boolean_type")]
    r#type: String,
    #[serde(default = "default_value_style")]
    value_style: String,
    #[serde(default)]
    position: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SchemaAction {
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    arguments: Vec<SchemaArgument>,
    #[serde(default)]
    parameters: Vec<SchemaParameter>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
struct ToolSchema {
    name: String,
    #[serde(default)]
    family: String,
    #[serde(default)]
    command_prefix: Vec<String>,
    #[serde(default)]
    description: String,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    source_path: String,
    #[serde(default)]
    executable_path: String,
    #[serde(default)]
    installed_name: String,
    #[serde(default)]
    metadata: SchemaMetadata,
    #[serde(default)]
    actions: Vec<SchemaAction>,
    #[serde(default)]
    arguments: Vec<SchemaArgument>,
    #[serde(default)]
    parameters: Vec<SchemaParameter>,
    #[serde(default)]
    tags: Vec<SchemaTag>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
struct FavoriteCommand {
    command: String,
    #[serde(default)]
    id: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    updated_at: String,
    #[serde(default)]
    builder_snapshot: Option<serde_json::Value>,
    #[serde(default)]
    tool: String,
    #[serde(default)]
    action: String,
    #[serde(default)]
    task: String,
    #[serde(default)]
    created_at: String,
    #[serde(default)]
    tags: Vec<SchemaTag>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AppSnapshot {
    data_root: String,
    schemas: Vec<ToolSchema>,
    favorites: Vec<FavoriteCommand>,
    log_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CliInstallResult {
    command_name: String,
    source_path: String,
    managed_script_path: String,
    shim_path: String,
    bin_dir: String,
    help_text: String,
}

#[derive(Debug, Deserialize)]
struct TomlTool {
    name: String,
    #[serde(default)]
    family: String,
    #[serde(default)]
    command_prefix: Vec<String>,
    #[serde(default)]
    description: String,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    executable_path: String,
    #[serde(default)]
    installed_name: String,
}

#[derive(Debug, Deserialize, Default)]
struct TomlMetadata {
    #[serde(default)]
    version: String,
    #[serde(default)]
    author: String,
    #[serde(default)]
    source: String,
    #[serde(default)]
    sha_256: String,
    #[serde(default)]
    homepage: String,
    #[serde(default)]
    executable_version: String,
    #[serde(default)]
    last_validated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecutableHealth {
    schema_name: String,
    status: String,
    message: String,
    checked_at: String,
}

fn default_string_type() -> String {
    "string".to_string()
}

fn default_boolean_type() -> String {
    "boolean".to_string()
}

fn default_value_style() -> String {
    "space".to_string()
}

fn default_required() -> bool {
    true
}

fn data_root() -> Result<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let local = dirs::data_local_dir().ok_or_else(|| CommandWizardError::Message("Could not resolve LOCALAPPDATA.".into()))?;
        Ok(local.join("Aptlantis").join("CommandWizard"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let local = dirs::data_local_dir().ok_or_else(|| CommandWizardError::Message("Could not resolve local data directory.".into()))?;
        Ok(local.join("Aptlantis").join("CommandWizard"))
    }
}

fn schema_dir() -> Result<PathBuf> {
    Ok(data_root()?.join("schemas"))
}

fn cli_script_dir() -> Result<PathBuf> {
    Ok(data_root()?.join("cli").join("scripts"))
}

fn cli_bin_dir() -> Result<PathBuf> {
    Ok(data_root()?.join("bin"))
}

fn history_path() -> Result<PathBuf> {
    Ok(data_root()?.join("history.json"))
}

fn log_path() -> Result<PathBuf> {
    Ok(data_root()?.join("commandwizard.log"))
}

fn ensure_dirs() -> Result<()> {
    fs::create_dir_all(schema_dir()?)?;
    fs::create_dir_all(cli_script_dir()?)?;
    fs::create_dir_all(cli_bin_dir()?)?;
    Ok(())
}

fn log_line(message: &str) {
    if let Ok(path) = log_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(path) {
            let _ = writeln!(file, "{message}");
        }
    }
}

fn sanitize_file_name(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
                ch
            } else {
                '_'
            }
        })
        .collect();
    if sanitized.trim().is_empty() {
        "tool".to_string()
    } else {
        sanitized
    }
}

fn string_field(table: &toml::map::Map<String, Value>, key: &str) -> String {
    table.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn bool_field(table: &toml::map::Map<String, Value>, key: &str, default_value: bool) -> bool {
    table.get(key).and_then(Value::as_bool).unwrap_or(default_value)
}

fn parse_argument(value: &Value) -> Option<SchemaArgument> {
    let table = value.as_table()?;
    let mut value_style = string_field(table, "value_style");
    if value_style.eq_ignore_ascii_case("equals_separated") {
        value_style = "equals".to_string();
    }
    if value_style.is_empty() {
        value_style = "space".to_string();
    }
    Some(SchemaArgument {
        flag: string_field(table, "flag"),
        long: string_field(table, "long"),
        description: string_field(table, "description"),
        r#type: table
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("boolean")
            .to_string(),
        value_style,
        position: string_field(table, "position"),
    })
}

fn parse_parameter(value: &Value) -> Option<SchemaParameter> {
    let table = value.as_table()?;
    Some(SchemaParameter {
        name: string_field(table, "name"),
        r#type: table
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("string")
            .to_string(),
        required: bool_field(table, "required", true),
    })
}

fn parse_schema_toml(text: &str, source_path: &Path) -> Result<ToolSchema> {
    let value: Value = toml::from_str(text)?;
    let root = value
        .as_table()
        .ok_or_else(|| CommandWizardError::Message("Schema root is not a table.".into()))?;
    let tool_value = root
        .get("tool")
        .ok_or_else(|| CommandWizardError::Message("Schema is missing [tool].".into()))?;
    let tool: TomlTool = tool_value.clone().try_into()?;
    if tool.name.trim().is_empty() {
        return Err(CommandWizardError::Message("Schema is missing tool.name.".into()));
    }
    let metadata = root
        .get("metadata")
        .map(|value| value.clone().try_into::<TomlMetadata>())
        .transpose()?
        .unwrap_or_default();

    let mut schema = ToolSchema {
        name: tool.name,
        description: tool.description,
        notes: tool.notes,
        source_path: source_path.to_string_lossy().to_string(),
        executable_path: tool.executable_path,
        installed_name: tool.installed_name,
        family: tool.family,
        command_prefix: tool.command_prefix,
        metadata: SchemaMetadata {
            version: metadata.version,
            author: metadata.author,
            source: metadata.source,
            sha_256: metadata.sha_256,
            homepage: metadata.homepage,
            executable_version: metadata.executable_version,
            last_validated: metadata.last_validated,
        },
        ..ToolSchema::default()
    };

    if let Some(actions) = root.get("actions").and_then(Value::as_array) {
        for item in actions {
            if let Some(table) = item.as_table() {
                let mut action = SchemaAction {
                    name: string_field(table, "name"),
                    description: string_field(table, "description"),
                    arguments: vec![],
                    parameters: vec![],
                };
                if let Some(args) = table.get("arguments").and_then(Value::as_array) {
                    action.arguments.extend(args.iter().filter_map(parse_argument));
                }
                if let Some(params) = table.get("parameters").and_then(Value::as_array) {
                    action.parameters.extend(params.iter().filter_map(parse_parameter));
                }
                if !action.name.trim().is_empty() {
                    schema.actions.push(action);
                }
            }
        }
    }

    if let Some(args) = root.get("arguments").and_then(Value::as_array) {
        schema.arguments.extend(args.iter().filter_map(parse_argument));
    }
    if let Some(params) = root.get("parameters").and_then(Value::as_array) {
        schema.parameters.extend(params.iter().filter_map(parse_parameter).filter(|item| !item.name.trim().is_empty()));
    }
    if let Some(tags) = root.get("tags").and_then(Value::as_array) {
        for item in tags {
            if let Some(table) = item.as_table() {
                let tag = SchemaTag {
                    name: string_field(table, "name"),
                    color: table
                        .get("color")
                        .and_then(Value::as_str)
                        .unwrap_or("#7A7A7A")
                        .to_string(),
                };
                if !tag.name.trim().is_empty() {
                    schema.tags.push(tag);
                }
            }
        }
    }
    Ok(schema)
}

fn serialize_schema_toml(schema: &ToolSchema) -> Result<String> {
    let mut lines = vec![
        "[tool]".to_string(),
        format!("name = {}", quote_toml(&schema.name)),
        format!("description = {}", quote_toml(&schema.description)),
    ];
    if !schema.family.is_empty() { lines.push(format!("family = {}", quote_toml(&schema.family))); }
    if !schema.command_prefix.is_empty() { lines.push(format!("command_prefix = {}", serde_json::to_string(&schema.command_prefix)?)); }
    if !schema.notes.trim().is_empty() {
        lines.push(format!("notes = {}", quote_toml(&schema.notes)));
    }
    if !schema.executable_path.trim().is_empty() {
        lines.push(format!("executable_path = {}", quote_toml(&schema.executable_path)));
    }
    if !schema.installed_name.trim().is_empty() {
        lines.push(format!("installed_name = {}", quote_toml(&schema.installed_name)));
    }

    let metadata_lines = schema_metadata_lines(&schema.metadata);
    if !metadata_lines.is_empty() {
        lines.push(String::new());
        lines.push("[metadata]".to_string());
        lines.extend(metadata_lines);
    }

    for action in &schema.actions {
        lines.push(String::new());
        lines.push("[[actions]]".to_string());
        lines.push(format!("name = {}", quote_toml(&action.name)));
        lines.push(format!("description = {}", quote_toml(&action.description)));
        for argument in &action.arguments {
            lines.push(String::new());
            lines.push("[[actions.arguments]]".to_string());
            lines.extend(argument_lines(argument));
        }
        for parameter in &action.parameters {
            lines.push(String::new());
            lines.push("[[actions.parameters]]".to_string());
            lines.extend(parameter_lines(parameter));
        }
    }

    for argument in &schema.arguments {
        lines.push(String::new());
        lines.push("[[arguments]]".to_string());
        lines.extend(argument_lines(argument));
    }
    for parameter in &schema.parameters {
        lines.push(String::new());
        lines.push("[[parameters]]".to_string());
        lines.extend(parameter_lines(parameter));
    }
    for tag in &schema.tags {
        lines.push(String::new());
        lines.push("[[tags]]".to_string());
        lines.push(format!("name = {}", quote_toml(&tag.name)));
        lines.push(format!(
            "color = {}",
            quote_toml(if tag.color.trim().is_empty() {
                "#7A7A7A"
            } else {
                &tag.color
            })
        ));
    }

    Ok(format!("{}\n", lines.join("\n")))
}

fn quote_toml(value: &str) -> String {
    serde_json::to_string(value).expect("strings always serialize")
}

fn argument_lines(argument: &SchemaArgument) -> Vec<String> {
    let mut lines = vec![
        format!("flag = {}", quote_toml(&argument.flag)),
        format!("description = {}", quote_toml(&argument.description)),
        format!("type = {}", quote_toml(&argument.r#type)),
    ];
    if argument.position == "before-prefix" { lines.push("position = \"before-prefix\"".to_string()); }
    if !argument.long.trim().is_empty() {
        lines.insert(1, format!("long = {}", quote_toml(&argument.long)));
    }
    if argument.value_style == "equals" || argument.value_style == "attached" {
        lines.push(format!("value_style = {}", quote_toml(&argument.value_style)));
    }
    lines
}

fn parameter_lines(parameter: &SchemaParameter) -> Vec<String> {
    vec![
        format!("name = {}", quote_toml(&parameter.name)),
        format!("type = {}", quote_toml(&parameter.r#type)),
        format!("required = {}", parameter.required),
    ]
}

fn schema_metadata_lines(metadata: &SchemaMetadata) -> Vec<String> {
    let mut lines = vec![];
    if !metadata.version.trim().is_empty() {
        lines.push(format!("version = {}", quote_toml(&metadata.version)));
    }
    if !metadata.author.trim().is_empty() {
        lines.push(format!("author = {}", quote_toml(&metadata.author)));
    }
    if !metadata.source.trim().is_empty() {
        lines.push(format!("source = {}", quote_toml(&metadata.source)));
    }
    if !metadata.sha_256.trim().is_empty() {
        lines.push(format!("sha_256 = {}", quote_toml(&metadata.sha_256)));
    }
    if !metadata.homepage.trim().is_empty() {
        lines.push(format!("homepage = {}", quote_toml(&metadata.homepage)));
    }
    if !metadata.executable_version.trim().is_empty() {
        lines.push(format!(
            "executable_version = {}",
            quote_toml(&metadata.executable_version)
        ));
    }
    if !metadata.last_validated.trim().is_empty() {
        lines.push(format!("last_validated = {}", quote_toml(&metadata.last_validated)));
    }
    lines
}

fn load_schemas() -> Result<Vec<ToolSchema>> {
    ensure_dirs()?;
    let mut schemas = vec![];
    for entry in fs::read_dir(schema_dir()?)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("toml") {
            continue;
        }
        match fs::read_to_string(&path).and_then(|text| parse_schema_toml(&text, &path).map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err.to_string()))) {
            Ok(schema) => schemas.push(schema),
            Err(err) => log_line(&format!("Failed to load schema {}: {err}", path.display())),
        }
    }
    schemas.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(schemas)
}

fn load_favorites() -> Result<Vec<FavoriteCommand>> {
    let path = history_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let text = fs::read_to_string(path)?;
    if text.trim().is_empty() {
        return Ok(vec![]);
    }
    Ok(serde_json::from_str(&text)?)
}

#[tauri::command]
fn load_snapshot() -> Result<AppSnapshot> {
    ensure_dirs()?;
    let root = data_root()?;
    Ok(AppSnapshot {
        data_root: root.to_string_lossy().to_string(),
        schemas: load_schemas()?,
        favorites: load_favorites()?,
        log_text: read_log().unwrap_or_default(),
    })
}

#[tauri::command]
fn save_schema(mut schema: ToolSchema) -> Result<ToolSchema> {
    ensure_dirs()?;
    if schema.name.trim().is_empty() {
        return Err(CommandWizardError::Message("Tool name is required.".into()));
    }
    let path = if schema.source_path.trim().is_empty() {
        schema_dir()?.join(format!("{}.toml", sanitize_file_name(&schema.name)))
    } else {
        PathBuf::from(&schema.source_path)
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let toml = serialize_schema_toml(&schema)?;
    fs::write(&path, toml)?;
    schema.source_path = path.to_string_lossy().to_string();
    log_line(&format!("Schema saved: {}", path.display()));
    Ok(schema)
}

#[tauri::command]
fn delete_schema(schema: ToolSchema) -> Result<()> {
    if !schema.source_path.trim().is_empty() {
        let path = PathBuf::from(&schema.source_path);
        if path.exists() {
            fs::remove_file(&path)?;
            log_line(&format!("Schema deleted: {}", path.display()));
        }
    }
    Ok(())
}

#[tauri::command]
fn save_favorites(favorites: Vec<FavoriteCommand>) -> Result<()> {
    let path = history_path()?;
    write_favorites_at(&path, &favorites)?;
    log_line(&format!("Favorites saved: {}", favorites.len()));
    Ok(())
}

fn write_favorites_at(path: &Path, favorites: &[FavoriteCommand]) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    if path.exists() {
        let existing = fs::read(path)?;
        let old: Vec<FavoriteCommand> = serde_json::from_slice(&existing)?;
        if old.iter().any(|entry| entry.id.is_empty() || entry.title.is_empty()) {
            let backup = path.with_extension(format!("backup-{}.json", SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos()));
            let mut file = fs::OpenOptions::new().write(true).create_new(true).open(backup)?;
            file.write_all(&existing)?;
            file.sync_all()?;
        }
    }
    let temporary = path.with_extension(format!("tmp-{}-{}", std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos()));
    let result = (|| -> Result<()> {
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temporary)?;
        file.write_all(&serde_json::to_vec_pretty(favorites)?)?;
        file.sync_all()?;
        drop(file);
        atomic_replace(&temporary, path)?;
        Ok(())
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result
}

fn atomic_replace(temporary: &Path, destination: &Path) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    if destination.exists() {
        use std::os::windows::ffi::OsStrExt;
        #[link(name = "kernel32")]
        extern "system" { fn ReplaceFileW(replaced: *const u16, replacement: *const u16, backup: *const u16, flags: u32, exclude: *mut std::ffi::c_void, reserved: *mut std::ffi::c_void) -> i32; }
        let replaced: Vec<u16> = destination.as_os_str().encode_wide().chain(Some(0)).collect();
        let replacement: Vec<u16> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
        let success = unsafe { ReplaceFileW(replaced.as_ptr(), replacement.as_ptr(), std::ptr::null(), 0, std::ptr::null_mut(), std::ptr::null_mut()) };
        if success == 0 { return Err(std::io::Error::last_os_error()); }
        return Ok(());
    }
    fs::rename(temporary, destination)?;
    Ok(())
}

#[tauri::command]
fn write_export_file(path: String, content: String) -> Result<()> {
    fs::write(&path, content)?;
    log_line(&format!("Export written: {path}"));
    Ok(())
}

#[tauri::command]
fn capture_help(command_name: String, help_args: String) -> Result<String> {
    if command_name.trim().is_empty() {
        return Err(CommandWizardError::Message("Command name is required.".into()));
    }
    log_line(&format!("Help capture: {} {}", command_name, help_args));
    run_command(&command_name, split_args(&help_args), Duration::from_secs(6))
}

#[tauri::command]
fn capture_completion(command_name: String) -> Result<Option<String>> {
    let probes = [
        "completion powershell",
        "completion bash",
        "completion zsh",
        "completion fish",
        "completions powershell",
        "--generate-completions powershell",
        "--completion powershell",
    ];
    for probe in probes {
        match run_command(&command_name, split_args(probe), Duration::from_secs(4)) {
            Ok(output) if is_likely_completion_script(&output) => return Ok(Some(output)),
            Ok(_) => {}
            Err(err) => log_line(&format!("Completion probe failed: {command_name} {probe}: {err}")),
        }
    }
    Ok(None)
}

#[tauri::command]
fn check_executables(schemas: Vec<ToolSchema>) -> Result<Vec<ExecutableHealth>> {
    Ok(schemas.iter().map(check_schema_executable).collect())
}

#[tauri::command]
fn install_cli_script(script_path: String, command_name: String, help_args: String) -> Result<CliInstallResult> {
    ensure_dirs()?;
    let source = PathBuf::from(script_path.trim());
    if !source.exists() || !source.is_file() {
        return Err(CommandWizardError::Message("Script path does not point to a file.".into()));
    }

    let inferred_name = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("script");
    let command = sanitize_command_name(if command_name.trim().is_empty() {
        inferred_name
    } else {
        command_name.trim()
    });
    if command.trim().is_empty() {
        return Err(CommandWizardError::Message("Command name is required.".into()));
    }

    let extension = source.extension().and_then(|value| value.to_str()).unwrap_or("");
    let managed_name = if extension.is_empty() {
        sanitize_file_name(source.file_name().and_then(|value| value.to_str()).unwrap_or(&command))
    } else {
        format!("{}.{}", sanitize_file_name(&command), extension)
    };
    let managed_script = cli_script_dir()?.join(managed_name);
    let help_text = run_script_probe(&source, split_args(if help_args.trim().is_empty() { "--help" } else { &help_args }), Duration::from_secs(6))?;
    fs::copy(&source, &managed_script)?;
    let shim = write_cli_shim(&command, &managed_script)?;
    log_line(&format!(
        "CLI script imported: {} -> {}",
        source.display(),
        shim.display()
    ));

    Ok(CliInstallResult {
        command_name: command,
        source_path: source.to_string_lossy().to_string(),
        managed_script_path: managed_script.to_string_lossy().to_string(),
        shim_path: shim.to_string_lossy().to_string(),
        bin_dir: cli_bin_dir()?.to_string_lossy().to_string(),
        help_text,
    })
}

#[tauri::command]
fn read_log() -> Result<String> {
    let path = log_path()?;
    if !path.exists() {
        return Ok(String::new());
    }
    Ok(fs::read_to_string(path)?)
}

fn sanitize_command_name(name: &str) -> String {
    sanitize_file_name(name).trim_matches('.').to_string()
}

fn write_cli_shim(command_name: &str, script_path: &Path) -> Result<PathBuf> {
    let bin_dir = cli_bin_dir()?;
    #[cfg(target_os = "windows")]
    {
        let shim = bin_dir.join(format!("{}.cmd", sanitize_command_name(command_name)));
        let body = windows_shim_body(script_path);
        fs::write(&shim, body)?;
        Ok(shim)
    }
    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let shim = bin_dir.join(sanitize_command_name(command_name));
        let body = unix_shim_body(script_path);
        fs::write(&shim, body)?;
        let mut permissions = fs::metadata(&shim)?.permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&shim, permissions)?;
        Ok(shim)
    }
}

#[cfg(target_os = "windows")]
fn windows_shim_body(script_path: &Path) -> String {
    let path = script_path.to_string_lossy();
    match script_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "ps1" => format!("@echo off\r\npowershell -NoProfile -ExecutionPolicy Bypass -File \"{path}\" %*\r\n"),
        "py" => format!("@echo off\r\npython \"{path}\" %*\r\n"),
        "js" | "mjs" => format!("@echo off\r\nnode \"{path}\" %*\r\n"),
        _ => format!("@echo off\r\n\"{path}\" %*\r\n"),
    }
}

#[cfg(not(target_os = "windows"))]
fn unix_shim_body(script_path: &Path) -> String {
    let path = script_path.to_string_lossy();
    match script_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "py" => format!("#!/usr/bin/env sh\nexec python3 \"{path}\" \"$@\"\n"),
        "js" | "mjs" => format!("#!/usr/bin/env sh\nexec node \"{path}\" \"$@\"\n"),
        _ => format!("#!/usr/bin/env sh\nexec \"{path}\" \"$@\"\n"),
    }
}

fn split_args(args: &str) -> Vec<String> {
    let mut parsed = vec![];
    let mut current = String::new();
    let mut in_single = false;
    let mut in_double = false;
    let mut escaped = false;

    for ch in args.chars() {
        if escaped {
            current.push(ch);
            escaped = false;
            continue;
        }
        if ch == '\\' && in_double {
            escaped = true;
            continue;
        }
        if ch == '\'' && !in_double {
            in_single = !in_single;
            continue;
        }
        if ch == '"' && !in_single {
            in_double = !in_double;
            continue;
        }
        if ch.is_whitespace() && !in_single && !in_double {
            if !current.is_empty() {
                parsed.push(std::mem::take(&mut current));
            }
            continue;
        }
        current.push(ch);
    }

    if !current.is_empty() {
        parsed.push(current);
    }

    parsed
}

fn run_script_probe(script_path: &Path, args: Vec<String>, timeout: Duration) -> Result<String> {
    let mut command_args = args;
    let executable = script_probe_executable(script_path, &mut command_args);
    run_command(&executable, command_args, timeout)
}

fn script_probe_executable(script_path: &Path, args: &mut Vec<String>) -> String {
    let path = script_path.to_string_lossy().to_string();
    match script_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        #[cfg(target_os = "windows")]
        "ps1" => {
            args.splice(
                0..0,
                [
                    "-NoProfile".to_string(),
                    "-ExecutionPolicy".to_string(),
                    "Bypass".to_string(),
                    "-File".to_string(),
                    path,
                ],
            );
            "powershell".to_string()
        }
        "py" => {
            args.insert(0, path);
            #[cfg(target_os = "windows")]
            {
                "python".to_string()
            }
            #[cfg(not(target_os = "windows"))]
            {
                "python3".to_string()
            }
        }
        "js" | "mjs" => {
            args.insert(0, path);
            "node".to_string()
        }
        _ => path,
    }
}

fn run_command(command_name: &str, args: Vec<String>, timeout: Duration) -> Result<String> {
    let mut child = spawn_probe(command_name, &args)?;

    let start = Instant::now();
    loop {
        if child.try_wait()?.is_some() {
            let output = child.wait_with_output()?;
            let mut text = String::new();
            text.push_str(&String::from_utf8_lossy(&output.stdout));
            if !output.stderr.is_empty() {
                if !text.trim().is_empty() {
                    text.push('\n');
                }
                text.push_str(&String::from_utf8_lossy(&output.stderr));
            }
            if text.trim().is_empty() {
                return Err(CommandWizardError::Message("Command produced no help output.".into()));
            }
            return Ok(text.trim().to_string());
        }
        if start.elapsed() > timeout {
            let _ = child.kill();
            return Err(CommandWizardError::Message("Command timed out.".into()));
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

fn spawn_probe(command_name: &str, args: &[String]) -> Result<std::process::Child> {
    match Command::new(command_name)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => Ok(child),
        Err(direct_err) => {
            #[cfg(target_os = "windows")]
            {
                log_line(&format!(
                    "Direct help probe failed for '{command_name}', retrying through cmd: {direct_err}"
                ));
                Command::new("cmd")
                    .arg("/C")
                    .arg(command_name)
                    .args(args)
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .map_err(|shell_err| {
                        CommandWizardError::Message(format!(
                            "Failed to start '{command_name}' directly ({direct_err}) or through cmd ({shell_err})."
                        ))
                    })
            }
            #[cfg(not(target_os = "windows"))]
            {
                Err(CommandWizardError::Message(format!(
                    "Failed to start '{command_name}': {direct_err}"
                )))
            }
        }
    }
}

fn is_likely_completion_script(output: &str) -> bool {
    let lower = output.to_lowercase();
    lower.contains("register-argumentcompleter")
        || lower.contains("complete -")
        || lower.contains("compdef")
        || lower.contains("_arguments")
        || lower.contains("function ")
        || lower.contains("shellcompdirective")
}

fn checked_at() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_default()
}

fn check_schema_executable(schema: &ToolSchema) -> ExecutableHealth {
    let checked_at = checked_at();
    let explicit_path = schema.executable_path.trim();
    if !explicit_path.is_empty() {
        let path = PathBuf::from(explicit_path);
        if path.exists() {
            return ExecutableHealth {
                schema_name: schema.name.clone(),
                status: "available".to_string(),
                message: format!("Executable path exists: {}", path.display()),
                checked_at,
            };
        }
        return ExecutableHealth {
            schema_name: schema.name.clone(),
            status: "missing".to_string(),
            message: format!("Executable path not found: {}", path.display()),
            checked_at,
        };
    }

    let command_name = if schema.installed_name.trim().is_empty() {
        schema.name.trim()
    } else {
        schema.installed_name.trim()
    };
    if command_name.is_empty() {
        return ExecutableHealth {
            schema_name: schema.name.clone(),
            status: "unknown".to_string(),
            message: "No executable name configured.".to_string(),
            checked_at,
        };
    }

    match resolve_command(command_name) {
        Ok(Some(path)) => ExecutableHealth {
            schema_name: schema.name.clone(),
            status: "available".to_string(),
            message: format!("{command_name} resolves to {path}"),
            checked_at,
        },
        Ok(None) => ExecutableHealth {
            schema_name: schema.name.clone(),
            status: "missing".to_string(),
            message: format!("{command_name} was not found on PATH."),
            checked_at,
        },
        Err(err) => ExecutableHealth {
            schema_name: schema.name.clone(),
            status: "unknown".to_string(),
            message: format!("Executable check failed: {err}"),
            checked_at,
        },
    }
}

fn resolve_command(command_name: &str) -> Result<Option<String>> {
    #[cfg(target_os = "windows")]
    let output = Command::new("where").arg(command_name).output()?;
    #[cfg(not(target_os = "windows"))]
    let output = Command::new("which").arg(command_name).output()?;

    if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout);
        return Ok(text.lines().next().map(|line| line.trim().to_string()).filter(|line| !line.is_empty()));
    }
    Ok(None)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_snapshot,
            save_schema,
            delete_schema,
            save_favorites,
            write_export_file,
            capture_help,
            capture_completion,
            check_executables,
            install_cli_script,
            read_log
        ])
        .setup(|app| {
            let _ = app.path().app_data_dir();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running CommandWizard");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_identity_and_scoped_fields_round_trip() {
        let source = r#"
[tool]
name = "cargo report future-incompatibilities"
installed_name = "cargo"
family = "cargo"
command_prefix = ["report", "future-incompatibilities"]
notes = "first\nsecond"
[[arguments]]
flag = "-C"
type = "string"
position = "before-prefix"
[[arguments]]
flag = "-c"
type = "string"
[[actions]]
name = "show"
[[actions.arguments]]
flag = "--verbose"
type = "boolean"
[[actions.parameters]]
name = "item"
required = true
"#;
        let schema = parse_schema_toml(source, Path::new("test.toml")).unwrap();
        let restored = parse_schema_toml(&serialize_schema_toml(&schema).unwrap(), Path::new("test.toml")).unwrap();
        assert_eq!(restored.command_prefix, vec!["report", "future-incompatibilities"]);
        assert_eq!(restored.notes, "first\nsecond");
        assert_eq!(restored.arguments[0].position, "before-prefix");
        assert_eq!(restored.actions[0].arguments[0].flag, "--verbose");
        assert_eq!(restored.actions[0].parameters[0].name, "item");
        // Cargo is the executable; the display name is never passed to lookup.
        assert_eq!(check_schema_executable(&schema).status, "available");
    }

    #[test]
    fn history_migration_preserves_original_and_atomic_updates() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("target").join(format!("history-test-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("history.json");
        let bytes = br#"[{"command":"  first\nsecond  \n","tool":"git","action":"","task":"legacy","createdAt":"old","tags":[{"name":"work","color":"red"}]}]"#;
        fs::write(&path, bytes).unwrap();
        let mut entries: Vec<FavoriteCommand> = serde_json::from_slice(bytes).unwrap();
        assert!(entries[0].id.is_empty());
        entries[0].id = "stable".into(); entries[0].title = "Legacy".into();
        entries[0].builder_snapshot = Some(serde_json::json!({"schema":{"name":"snapshot"}}));
        write_favorites_at(&path, &entries).unwrap();
        let backup = fs::read_dir(&dir).unwrap().filter_map(|p| p.ok()).find(|p| p.file_name().to_string_lossy().contains("backup-")).unwrap();
        assert_eq!(fs::read(backup.path()).unwrap(), bytes);
        let restored: Vec<FavoriteCommand> = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(restored[0].command, "  first\nsecond  \n");
        assert_eq!(restored[0].tags[0].name, "work");
        assert_eq!(restored[0].builder_snapshot, entries[0].builder_snapshot);
        entries[0].title = "Edited".into(); write_favorites_at(&path, &entries).unwrap();
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 2);
        #[cfg(target_os = "windows")]
        {
            let original = fs::read(&path).unwrap();
            let mut permissions = fs::metadata(&path).unwrap().permissions();
            permissions.set_readonly(true); fs::set_permissions(&path, permissions).unwrap();
            assert!(write_favorites_at(&path, &[]).is_err());
            assert_eq!(fs::read(&path).unwrap(), original);
            assert_eq!(fs::read_dir(&dir).unwrap().count(), 2); // failed temporary file was cleaned
            let mut permissions = fs::metadata(&path).unwrap().permissions();
            permissions.set_readonly(false); fs::set_permissions(&path, permissions).unwrap();
        }
        fs::write(&path, "broken history").unwrap();
        assert!(write_favorites_at(&path, &entries).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "broken history");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn all_repository_catalog_schemas_parse_and_round_trip() {
        let directory = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().join("schemas");
        for entry in fs::read_dir(directory).unwrap() {
            let path = entry.unwrap().path();
            if path.extension().and_then(|e| e.to_str()) != Some("toml") { continue; }
            let schema = parse_schema_toml(&fs::read_to_string(&path).unwrap(), &path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
            let restored = parse_schema_toml(&serialize_schema_toml(&schema).unwrap(), &path).unwrap();
            assert_eq!(schema.name, restored.name);
            assert_eq!(schema.command_prefix, restored.command_prefix);
            assert_eq!(schema.arguments.len(), restored.arguments.len());
        }
    }

    #[test]
    fn parses_existing_schema_shape() {
        let toml = r#"
[tool]
name = "rsync"
description = "Fast file synchronization tool"

[[arguments]]
flag = "-a"
long = "--archive"
description = "archive mode"
type = "boolean"

[[parameters]]
name = "source"
type = "path"
"#;
        let schema = parse_schema_toml(toml, Path::new("rsync.toml")).unwrap();
        assert_eq!(schema.name, "rsync");
        assert_eq!(schema.arguments.len(), 1);
        assert_eq!(schema.parameters.len(), 1);
        assert_eq!(schema.parameters[0].required, true);
        assert_eq!(schema.metadata, SchemaMetadata::default());
    }

    #[test]
    fn round_trips_schema_metadata() {
        let toml = r#"
[tool]
name = "yt-dlp"
description = "Video downloader"
installed_name = "yt-dlp"

[metadata]
version = "1"
author = "Herb"
source = "help import; completion imported"
sha_256 = "3B2C1A0D4E5F6789ABCDEF0123456789ABCDEF0123456789ABCDEF012345678"
homepage = "https://example.com/yt-dlp"
executable_version = "2026.07.01"
last_validated = "2026-07-30T12:00:00.000Z"
"#;
        let schema = parse_schema_toml(toml, Path::new("yt-dlp.toml")).unwrap();
        assert_eq!(schema.metadata.source, "help import; completion imported");
        assert_eq!(schema.metadata.sha_256, "3B2C1A0D4E5F6789ABCDEF0123456789ABCDEF0123456789ABCDEF012345678");
        assert_eq!(schema.metadata.executable_version, "2026.07.01");

        let serialized = serialize_schema_toml(&schema).unwrap();
        assert!(serialized.contains("[metadata]"));
        assert!(serialized.contains("sha_256 = \"3B2C1A0D4E5F6789ABCDEF0123456789ABCDEF0123456789ABCDEF012345678\""));
    }

    #[test]
    fn serializes_value_styles() {
        let mut schema = ToolSchema {
            name: "demo".into(),
            description: "Demo".into(),
            ..ToolSchema::default()
        };
        schema.arguments.push(SchemaArgument {
            position: String::new(),
            flag: "--config".into(),
            long: String::new(),
            description: "Config".into(),
            r#type: "string".into(),
            value_style: "equals".into(),
        });
        let text = serialize_schema_toml(&schema).unwrap();
        assert!(text.contains("value_style = \"equals\""));
        let reparsed = parse_schema_toml(&text, Path::new("demo.toml")).unwrap();
        assert_eq!(reparsed.arguments[0].value_style, "equals");
    }

    #[test]
    fn sanitizes_schema_file_names() {
        assert_eq!(sanitize_file_name("my tool/name"), "my_tool_name");
        assert_eq!(sanitize_file_name(""), "tool");
    }

    #[test]
    fn detects_completion_scripts() {
        assert!(is_likely_completion_script("Register-ArgumentCompleter -CommandName foo"));
        assert!(!is_likely_completion_script("Error: missing module"));
    }

    #[test]
    fn creates_windows_shims_for_known_script_types() {
        #[cfg(target_os = "windows")]
        {
            let body = windows_shim_body(Path::new("C:\\tools\\demo.ps1"));
            assert!(body.contains("powershell -NoProfile"));
            assert!(body.contains("-File \"C:\\tools\\demo.ps1\""));
        }
    }

    #[test]
    fn splits_quoted_help_arguments() {
        assert_eq!(split_args("--help"), vec!["--help"]);
        assert_eq!(split_args("help \"nested command\""), vec!["help", "nested command"]);
        assert_eq!(split_args("help 'nested command'"), vec!["help", "nested command"]);
    }
}
