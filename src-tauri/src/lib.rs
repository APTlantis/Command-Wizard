use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant},
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

#[derive(Debug, Deserialize)]
struct TomlTool {
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    executable_path: String,
    #[serde(default)]
    installed_name: String,
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

fn history_path() -> Result<PathBuf> {
    Ok(data_root()?.join("history.json"))
}

fn log_path() -> Result<PathBuf> {
    Ok(data_root()?.join("commandwizard.log"))
}

fn ensure_dirs() -> Result<()> {
    fs::create_dir_all(schema_dir()?)?;
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

    let mut schema = ToolSchema {
        name: tool.name,
        description: tool.description,
        notes: tool.notes,
        source_path: source_path.to_string_lossy().to_string(),
        executable_path: tool.executable_path,
        installed_name: tool.installed_name,
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
    if !schema.notes.trim().is_empty() {
        lines.push(format!("notes = {}", quote_toml(&schema.notes)));
    }
    if !schema.executable_path.trim().is_empty() {
        lines.push(format!("executable_path = {}", quote_toml(&schema.executable_path)));
    }
    if !schema.installed_name.trim().is_empty() {
        lines.push(format!("installed_name = {}", quote_toml(&schema.installed_name)));
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
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn argument_lines(argument: &SchemaArgument) -> Vec<String> {
    let mut lines = vec![
        format!("flag = {}", quote_toml(&argument.flag)),
        format!("description = {}", quote_toml(&argument.description)),
        format!("type = {}", quote_toml(&argument.r#type)),
    ];
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
        favorites: load_favorites().unwrap_or_else(|err| {
            log_line(&format!("Favorites load failed: {err}"));
            vec![]
        }),
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
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&path, serde_json::to_string_pretty(&favorites)?)?;
    log_line(&format!("Favorites saved: {}", favorites.len()));
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
fn read_log() -> Result<String> {
    let path = log_path()?;
    if !path.exists() {
        return Ok(String::new());
    }
    Ok(fs::read_to_string(path)?)
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
    }

    #[test]
    fn serializes_value_styles() {
        let mut schema = ToolSchema {
            name: "demo".into(),
            description: "Demo".into(),
            ..ToolSchema::default()
        };
        schema.arguments.push(SchemaArgument {
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
    fn splits_quoted_help_arguments() {
        assert_eq!(split_args("--help"), vec!["--help"]);
        assert_eq!(split_args("help \"nested command\""), vec!["help", "nested command"]);
        assert_eq!(split_args("help 'nested command'"), vec!["help", "nested command"]);
    }
}
