using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Windows;
using System.Windows.Data;
using CommandWizard.Models;
using CommandWizard.Services;

namespace CommandWizard.ViewModels
{
    public sealed class MainViewModel : ViewModelBase
    {
        private readonly string _schemaDirectory;
        private readonly string _historyPath;
        private ToolSchemaViewModel? _selectedTool;
        private SchemaAction? _selectedAction;
        private string _taskLabel = string.Empty;
        private string _commandPreview = string.Empty;
        private SchemaAction? _selectedActionForEdit;
        private SchemaArgument? _selectedArgumentForEdit;
        private SchemaParameter? _selectedParameterForEdit;
        private SchemaTag? _selectedTagForEdit;
        private string _pasteCommandText = string.Empty;
        private string _toolSearchText = string.Empty;
        private string _selectedTagFilter = "All";
        private string _selectedFavoriteTagFilter = "All";
        private string _favoriteSearchText = string.Empty;

        private CommandPartViewModel? _toolPart;
        private CommandPartViewModel? _actionPart;
        private readonly Dictionary<OptionItemViewModel, CommandPartViewModel> _optionPartMap = new();
        private readonly Dictionary<ParameterItemViewModel, CommandPartViewModel> _paramPartMap = new();
        private bool _suppressOptionSync;
        private bool _suppressParameterSync;

        public MainViewModel()
        {
            var dataRoot = AppPaths.ResolveDataRoot();
            _schemaDirectory = Path.Combine(dataRoot, "schemas");
            _historyPath = Path.Combine(dataRoot, "history.json");
            Tools = new ObservableCollection<ToolSchemaViewModel>();
            Favorites = new ObservableCollection<FavoriteCommandViewModel>();
            ToolsView = CollectionViewSource.GetDefaultView(Tools);
            ToolsView.Filter = FilterTool;
            Tools.CollectionChanged += (_, __) => RefreshTagFilters();
            FavoritesView = CollectionViewSource.GetDefaultView(Favorites);
            FavoritesView.Filter = FilterFavorite;
            InitializeTagPresets();
            LoadSchemas();
            LoadFavorites();
            RefreshTagFilters();
            RefreshFavoriteTagFilters();
        }

        internal MainViewModel(System.Collections.Generic.IEnumerable<ToolSchema> schemas)
        {
            var dataRoot = AppPaths.ResolveDataRoot();
            _schemaDirectory = Path.Combine(dataRoot, "schemas");
            _historyPath = Path.Combine(dataRoot, "history.json");
            Tools = new ObservableCollection<ToolSchemaViewModel>(
                schemas.Select(schema => new ToolSchemaViewModel(schema)));
            Favorites = new ObservableCollection<FavoriteCommandViewModel>();
            ToolsView = CollectionViewSource.GetDefaultView(Tools);
            ToolsView.Filter = FilterTool;
            Tools.CollectionChanged += (_, __) => RefreshTagFilters();
            FavoritesView = CollectionViewSource.GetDefaultView(Favorites);
            FavoritesView.Filter = FilterFavorite;
            InitializeTagPresets();
            foreach (var tool in Tools)
            {
                RegisterTool(tool);
            }
            SelectedTool = Tools.FirstOrDefault();
            LoadFavorites();
            RefreshTagFilters();
            RefreshFavoriteTagFilters();
        }

        public ObservableCollection<ToolSchemaViewModel> Tools { get; }
        public ObservableCollection<FavoriteCommandViewModel> Favorites { get; }
        public ICollectionView ToolsView { get; }
        public ObservableCollection<string> TagFilters { get; } = new();
        public ICollectionView FavoritesView { get; }
        public ObservableCollection<string> FavoriteTagFilters { get; } = new();
        public IReadOnlyList<Models.TagPreset> TagPresets { get; } = new List<Models.TagPreset>();
        public ObservableCollection<CommandPartViewModel> CommandParts { get; } = new();

        public ToolSchemaViewModel? SelectedTool
        {
            get => _selectedTool;
            set
            {
                if (_selectedTool == value) return;
                DetachToolHandlers(_selectedTool);
                _selectedTool = value;
                AttachToolHandlers(_selectedTool);
                ResetCommandParts(_selectedTool);
                _selectedAction = null;
                SelectedAction = _selectedTool?.Actions.FirstOrDefault();
                OnPropertyChanged();
            }
        }

        public SchemaAction? SelectedAction
        {
            get => _selectedAction;
            set
            {
                if (_selectedAction == value) return;
                _selectedAction = value;
                OnPropertyChanged();
                SyncActionPart();
            }
        }

        public SchemaAction? SelectedActionForEdit
        {
            get => _selectedActionForEdit;
            set
            {
                if (_selectedActionForEdit == value) return;
                _selectedActionForEdit = value;
                OnPropertyChanged();
            }
        }

        public SchemaArgument? SelectedArgumentForEdit
        {
            get => _selectedArgumentForEdit;
            set
            {
                if (_selectedArgumentForEdit == value) return;
                _selectedArgumentForEdit = value;
                OnPropertyChanged();
            }
        }

        public SchemaParameter? SelectedParameterForEdit
        {
            get => _selectedParameterForEdit;
            set
            {
                if (_selectedParameterForEdit == value) return;
                _selectedParameterForEdit = value;
                OnPropertyChanged();
            }
        }

        public SchemaTag? SelectedTagForEdit
        {
            get => _selectedTagForEdit;
            set
            {
                if (_selectedTagForEdit == value) return;
                _selectedTagForEdit = value;
                OnPropertyChanged();
            }
        }

        public string TaskLabel
        {
            get => _taskLabel;
            set
            {
                if (_taskLabel == value) return;
                _taskLabel = value;
                OnPropertyChanged();
            }
        }

        public string CommandPreview
        {
            get => _commandPreview;
            private set
            {
                if (_commandPreview == value) return;
                _commandPreview = value;
                OnPropertyChanged();
            }
        }

        public string PasteCommandText
        {
            get => _pasteCommandText;
            set
            {
                if (_pasteCommandText == value) return;
                _pasteCommandText = value;
                OnPropertyChanged();
            }
        }

        public string ToolSearchText
        {
            get => _toolSearchText;
            set
            {
                if (_toolSearchText == value) return;
                _toolSearchText = value;
                OnPropertyChanged();
                ToolsView.Refresh();
            }
        }

        public string SelectedTagFilter
        {
            get => _selectedTagFilter;
            set
            {
                if (_selectedTagFilter == value) return;
                _selectedTagFilter = value;
                OnPropertyChanged();
                ToolsView.Refresh();
            }
        }

        public string SelectedFavoriteTagFilter
        {
            get => _selectedFavoriteTagFilter;
            set
            {
                if (_selectedFavoriteTagFilter == value) return;
                _selectedFavoriteTagFilter = value;
                OnPropertyChanged();
                FavoritesView.Refresh();
            }
        }

        public string FavoriteSearchText
        {
            get => _favoriteSearchText;
            set
            {
                if (_favoriteSearchText == value) return;
                _favoriteSearchText = value;
                OnPropertyChanged();
                FavoritesView.Refresh();
            }
        }

        public void CopyCommand()
        {
            if (string.IsNullOrWhiteSpace(CommandPreview))
            {
                MessageBox.Show("No command to copy yet.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            Clipboard.SetText(CommandPreview);
            MessageBox.Show("Command copied to clipboard.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        public void GenerateCommand()
        {
            if (string.IsNullOrWhiteSpace(CommandPreview))
            {
                MessageBox.Show("No command to save yet.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            AddFavorite(CommandPreview);
            MessageBox.Show("Command saved to favorites.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        public void UpdateCommandPreview()
        {
            RebuildPreview();
        }

        public void MoveCommandPart(int fromIndex, int toIndex)
        {
            if (fromIndex == toIndex) return;
            if (fromIndex < 0 || toIndex < 0) return;
            if (fromIndex >= CommandParts.Count || toIndex >= CommandParts.Count) return;
            CommandParts.Move(fromIndex, toIndex);
            RebuildPreview();
        }

        public void RemoveCommandPart(CommandPartViewModel part)
        {
            if (part.IsFixed) return;

            switch (part.Role)
            {
                case CommandPartRole.Action:
                    part.ValueChanged -= OnCommandPartValueChanged;
                    CommandParts.Remove(part);
                    _actionPart = null;
                    _suppressOptionSync = true;
                    try { SelectedAction = null; }
                    finally { _suppressOptionSync = false; }
                    break;

                case CommandPartRole.Argument:
                    PurgeOptionPart(part);
                    break;

                case CommandPartRole.Parameter:
                    PurgeParameterPart(part);
                    break;
            }

            RebuildPreview();
        }

        private void ResetCommandParts(ToolSchemaViewModel? tool)
        {
            _suppressOptionSync = true;
            _suppressParameterSync = true;
            try
            {
                foreach (var vm in CommandParts)
                    vm.ValueChanged -= OnCommandPartValueChanged;
                CommandParts.Clear();
                _optionPartMap.Clear();
                _paramPartMap.Clear();
                _toolPart = null;
                _actionPart = null;

                if (tool == null)
                {
                    CommandPreview = string.Empty;
                    return;
                }

                var part = new CommandPart { Role = CommandPartRole.Tool, Token = tool.CommandName, IsFixed = true };
                _toolPart = new CommandPartViewModel(part, RemoveCommandPart);
                _toolPart.ValueChanged += OnCommandPartValueChanged;
                CommandParts.Add(_toolPart);
            }
            finally
            {
                _suppressOptionSync = false;
                _suppressParameterSync = false;
            }
            RebuildPreview();
        }

        private void SyncActionPart()
        {
            if (_actionPart != null)
            {
                _actionPart.ValueChanged -= OnCommandPartValueChanged;
                CommandParts.Remove(_actionPart);
                _actionPart = null;
            }

            if (_selectedAction != null && !string.IsNullOrWhiteSpace(_selectedAction.Name))
            {
                var part = new CommandPart { Role = CommandPartRole.Action, Token = _selectedAction.Name };
                _actionPart = new CommandPartViewModel(part, RemoveCommandPart);
                _actionPart.ValueChanged += OnCommandPartValueChanged;
                var insertIdx = _toolPart != null ? CommandParts.IndexOf(_toolPart) + 1 : 0;
                CommandParts.Insert(Math.Min(insertIdx, CommandParts.Count), _actionPart);
            }

            RebuildPreview();
        }

        private void SyncOptionPart(OptionItemViewModel option)
        {
            if (_suppressOptionSync) return;

            if (option.IsBoolean)
            {
                if (option.IsSelected)
                {
                    if (!_optionPartMap.ContainsKey(option) && !string.IsNullOrWhiteSpace(option.DisplayName))
                    {
                        var part = new CommandPart
                        {
                            Role = CommandPartRole.Argument,
                            Token = option.DisplayName,
                            SourceArgument = option.Argument
                        };
                        var vm = new CommandPartViewModel(part, RemoveCommandPart);
                        CommandParts.Add(vm);
                        _optionPartMap[option] = vm;
                    }
                }
                else
                {
                    if (_optionPartMap.TryGetValue(option, out var flagVm))
                    {
                        flagVm.ValueChanged -= OnCommandPartValueChanged;
                        CommandParts.Remove(flagVm);
                        _optionPartMap.Remove(option);
                    }
                }
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(option.Value))
                {
                    if (_optionPartMap.TryGetValue(option, out var flagVm))
                    {
                        // Update value chip
                        var valueVm = CommandParts.FirstOrDefault(p => flagVm.Part.LinkedValueId.HasValue && p.Id == flagVm.Part.LinkedValueId.Value);
                        if (valueVm != null)
                            valueVm.Value = option.Value.Trim();
                    }
                    else if (!string.IsNullOrWhiteSpace(option.DisplayName))
                    {
                        var newFlagPart = new CommandPart
                        {
                            Role = CommandPartRole.Argument,
                            Token = option.DisplayName,
                            SourceArgument = option.Argument
                        };
                        var newValuePart = new CommandPart
                        {
                            Role = CommandPartRole.ArgumentValue,
                            Token = option.Value.Trim(),
                            SourceArgument = option.Argument,
                            LinkedValueId = newFlagPart.Id
                        };
                        newFlagPart.LinkedValueId = newValuePart.Id;

                        var newFlagVm = new CommandPartViewModel(newFlagPart, RemoveCommandPart);
                        var newValueVm = new CommandPartViewModel(newValuePart, RemoveCommandPart);
                        newValueVm.ValueChanged += OnCommandPartValueChanged;

                        CommandParts.Add(newFlagVm);
                        CommandParts.Add(newValueVm);
                        _optionPartMap[option] = newFlagVm;
                    }
                }
                else
                {
                    if (_optionPartMap.TryGetValue(option, out var flagVm))
                    {
                        var valueVm = CommandParts.FirstOrDefault(p => flagVm.Part.LinkedValueId.HasValue && p.Id == flagVm.Part.LinkedValueId.Value);
                        if (valueVm != null)
                        {
                            valueVm.ValueChanged -= OnCommandPartValueChanged;
                            CommandParts.Remove(valueVm);
                        }
                        flagVm.ValueChanged -= OnCommandPartValueChanged;
                        CommandParts.Remove(flagVm);
                        _optionPartMap.Remove(option);
                    }
                }
            }

            RebuildPreview();
        }

        private void SyncParameterPart(ParameterItemViewModel param)
        {
            if (_suppressParameterSync) return;

            if (!string.IsNullOrWhiteSpace(param.Value))
            {
                if (_paramPartMap.TryGetValue(param, out var existing))
                {
                    existing.Value = param.Value.Trim();
                }
                else
                {
                    var part = new CommandPart
                    {
                        Role = CommandPartRole.Parameter,
                        Token = param.Value.Trim(),
                        SourceParameter = param.Parameter
                    };
                    var vm = new CommandPartViewModel(part, RemoveCommandPart);
                    vm.ValueChanged += OnCommandPartValueChanged;
                    CommandParts.Add(vm);
                    _paramPartMap[param] = vm;
                }
            }
            else
            {
                if (_paramPartMap.TryGetValue(param, out var existing))
                {
                    existing.ValueChanged -= OnCommandPartValueChanged;
                    CommandParts.Remove(existing);
                    _paramPartMap.Remove(param);
                }
            }

            RebuildPreview();
        }

        private void PurgeOptionPart(CommandPartViewModel flagVm)
        {
            var option = _optionPartMap.Keys.FirstOrDefault(o => _optionPartMap[o] == flagVm);
            if (option == null) return;

            var valueVm = flagVm.Part.LinkedValueId.HasValue
                ? CommandParts.FirstOrDefault(p => p.Id == flagVm.Part.LinkedValueId.Value)
                : null;

            if (valueVm != null)
            {
                valueVm.ValueChanged -= OnCommandPartValueChanged;
                CommandParts.Remove(valueVm);
            }
            flagVm.ValueChanged -= OnCommandPartValueChanged;
            CommandParts.Remove(flagVm);
            _optionPartMap.Remove(option);

            _suppressOptionSync = true;
            try
            {
                if (option.IsBoolean) option.IsSelected = false;
                else option.Value = string.Empty;
            }
            finally { _suppressOptionSync = false; }
        }

        private void PurgeParameterPart(CommandPartViewModel vm)
        {
            var param = _paramPartMap.Keys.FirstOrDefault(p => _paramPartMap[p] == vm);
            if (param == null) return;

            vm.ValueChanged -= OnCommandPartValueChanged;
            CommandParts.Remove(vm);
            _paramPartMap.Remove(param);

            _suppressParameterSync = true;
            try { param.Value = string.Empty; }
            finally { _suppressParameterSync = false; }
        }

        public void PurgeCommandPartForOption(OptionItemViewModel option)
        {
            if (_optionPartMap.TryGetValue(option, out var flagVm))
                PurgeOptionPart(flagVm);
        }

        public void PurgeCommandPartForParam(ParameterItemViewModel param)
        {
            if (_paramPartMap.TryGetValue(param, out var vm))
                PurgeParameterPart(vm);
        }

        private void RebuildPreview()
        {
            CommandPreview = CommandBuilder.TokensFromParts(CommandParts);
        }

        private void OnCommandPartValueChanged(object? sender, EventArgs e)
        {
            RebuildPreview();
        }

        public void AddNewSchema()
        {
            var schema = new ToolSchema
            {
                Name = "new-tool",
                Description = "",
                SourcePath = ""
            };
            var vm = new ToolSchemaViewModel(schema);
            RegisterTool(vm);
            Tools.Add(vm);
            SelectedTool = vm;
        }

        public bool ImportSchemaFromHelp(string commandName, string helpArgs, bool useAdvancedSources, System.Collections.Generic.IEnumerable<string>? excludedFlags = null)
        {
            if (string.IsNullOrWhiteSpace(commandName))
            {
                MessageBox.Show("Command name is required.", "Import Schema", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            AppLogger.Info($"Import start (command): {commandName} {helpArgs} | advanced={useAdvancedSources}");

            if (!HelpSchemaImporter.TryImportFromCommand(commandName, helpArgs, useAdvancedSources, out var schema, out var error))
            {
                var message = string.IsNullOrWhiteSpace(error) ? "Import failed." : error;
                AppLogger.Error($"Import failed (command): {commandName}", new InvalidOperationException(message));
                MessageBox.Show(message, "Import Schema", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            ApplyImportExclusions(schema, excludedFlags);
            schema.SourcePath = string.Empty;
            var vm = new ToolSchemaViewModel(schema);
            vm.IsImportedUnsaved = true;
            RegisterTool(vm);
            Tools.Add(vm);
            SelectedTool = vm;
            AppLogger.Info($"Import success (command): {commandName} | {vm.ImportSummary}");
            MessageBox.Show(
                $"Schema imported. {vm.ImportSummary}. Review and save when ready.",
                "Import Schema",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
            return true;
        }

        public bool ImportSchemaFromHelpText(string commandName, string helpText, bool useAdvancedSources, System.Collections.Generic.IEnumerable<string>? excludedFlags = null)
        {
            if (string.IsNullOrWhiteSpace(commandName))
            {
                MessageBox.Show("Command name is required.", "Import Schema", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            helpText ??= string.Empty;
            AppLogger.Info($"Import start (paste): {commandName} (len={helpText.Length}) | advanced={useAdvancedSources}");

            if (!HelpSchemaImporter.TryImportFromHelpText(commandName, helpText, useAdvancedSources, out var schema, out var error))
            {
                var message = string.IsNullOrWhiteSpace(error) ? "Import failed." : error;
                AppLogger.Error($"Import failed (paste): {commandName}", new InvalidOperationException(message));
                MessageBox.Show(message, "Import Schema", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            ApplyImportExclusions(schema, excludedFlags);
            schema.SourcePath = string.Empty;
            var vm = new ToolSchemaViewModel(schema);
            vm.IsImportedUnsaved = true;
            RegisterTool(vm);
            Tools.Add(vm);
            SelectedTool = vm;
            AppLogger.Info($"Import success (paste): {commandName} | {vm.ImportSummary}");
            MessageBox.Show(
                $"Schema imported. {vm.ImportSummary}. Review and save when ready.",
                "Import Schema",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
            return true;
        }

        public bool ImportSchemaFromDraft(HelpImportDraft draft)
        {
            if (draft == null)
            {
                MessageBox.Show("No reviewed import draft is available.", "Import Schema", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            var schema = HelpImportPipeline.BuildSchemaFromDraft(draft);
            if (string.IsNullOrWhiteSpace(schema.Name))
            {
                MessageBox.Show("Tool name is required.", "Import Schema", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            schema.SourcePath = string.Empty;
            var vm = new ToolSchemaViewModel(schema);
            vm.IsImportedUnsaved = true;
            RegisterTool(vm);
            Tools.Add(vm);
            SelectedTool = vm;
            AppLogger.Info($"Import success (reviewed draft): {schema.Name} | {vm.ImportSummary}");
            MessageBox.Show(
                $"Schema imported. {vm.ImportSummary}. Review and save when ready.",
                "Import Schema",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
            return true;
        }

        public void AddAction()
        {
            if (SelectedTool == null) return;
            var action = new SchemaAction { Name = "action", Description = "" };
            SelectedTool.Actions.Add(action);
            SelectedActionForEdit = action;
        }

        public void RemoveAction()
        {
            if (SelectedTool == null || SelectedActionForEdit == null) return;
            SelectedTool.Actions.Remove(SelectedActionForEdit);
            if (SelectedAction == SelectedActionForEdit)
            {
                SelectedAction = SelectedTool.Actions.FirstOrDefault();
            }
            SelectedActionForEdit = null;
            UpdateCommandPreview();
        }

        public void AddArgument()
        {
            if (SelectedTool == null) return;
            var argument = new SchemaArgument
            {
                Flag = "--flag",
                Long = "",
                Description = "",
                Type = "boolean"
            };
            SelectedTool.Schema.Arguments.Add(argument);
            var optionVm = new OptionItemViewModel(argument);
            optionVm.PropertyChanged += OptionOnPropertyChanged;
            SelectedTool.Options.Add(optionVm);
            SelectedArgumentForEdit = argument;
        }

        public void RemoveArgument()
        {
            if (SelectedTool == null || SelectedArgumentForEdit == null) return;
            SelectedTool.Schema.Arguments.Remove(SelectedArgumentForEdit);
            var optionVm = SelectedTool.Options.FirstOrDefault(o => o.Argument == SelectedArgumentForEdit);
            if (optionVm != null)
            {
                PurgeCommandPartForOption(optionVm);
                optionVm.PropertyChanged -= OptionOnPropertyChanged;
                SelectedTool.Options.Remove(optionVm);
            }
            SelectedArgumentForEdit = null;
            RebuildPreview();
        }

        public void AddParameter()
        {
            if (SelectedTool == null) return;
            var parameter = new SchemaParameter { Name = "param", Type = "string", Required = true };
            SelectedTool.Schema.Parameters.Add(parameter);
            var paramVm = new ParameterItemViewModel(parameter);
            paramVm.PropertyChanged += ParameterOnPropertyChanged;
            SelectedTool.Parameters.Add(paramVm);
            SelectedParameterForEdit = parameter;
        }

        public void AddTag()
        {
            if (SelectedTool == null) return;
            var defaultColor = TagPresets.FirstOrDefault(p => p.Name == "Blue 500")?.Color ??
                               TagPresets.FirstOrDefault()?.Color ??
                               "#7A7A7A";
            var tag = new SchemaTag { Name = "tag", Color = defaultColor };
            SelectedTool.Schema.Tags.Add(tag);
            SelectedTagForEdit = tag;
        }

        public void ApplyTagColor(string color)
        {
            if (SelectedTagForEdit != null)
                SelectedTagForEdit.Color = color;
        }

        public void RemoveTag()
        {
            if (SelectedTool == null || SelectedTagForEdit == null) return;
            SelectedTool.Schema.Tags.Remove(SelectedTagForEdit);
            SelectedTagForEdit = null;
        }

        public void RemoveParameter()
        {
            if (SelectedTool == null || SelectedParameterForEdit == null) return;
            SelectedTool.Schema.Parameters.Remove(SelectedParameterForEdit);
            var paramVm = SelectedTool.Parameters.FirstOrDefault(p => p.Parameter == SelectedParameterForEdit);
            if (paramVm != null)
            {
                PurgeCommandPartForParam(paramVm);
                paramVm.PropertyChanged -= ParameterOnPropertyChanged;
                SelectedTool.Parameters.Remove(paramVm);
            }
            SelectedParameterForEdit = null;
            RebuildPreview();
        }

        public void SaveSelectedSchema()
        {
            if (SelectedTool == null)
            {
                MessageBox.Show("Select a tool to save.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            if (string.IsNullOrWhiteSpace(SelectedTool.ToolName))
            {
                MessageBox.Show("Tool name is required.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var filePath = SelectedTool.SourcePath;
            if (string.IsNullOrWhiteSpace(filePath))
            {
                var safeName = new string(SelectedTool.ToolName
                    .ToLowerInvariant()
                    .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-')
                    .ToArray())
                    .Trim('-');
                if (string.IsNullOrWhiteSpace(safeName))
                {
                    safeName = "tool";
                }
                filePath = Path.Combine(_schemaDirectory, $"{safeName}.toml");
                SelectedTool.SourcePath = filePath;
            }

            try
            {
                Directory.CreateDirectory(_schemaDirectory);
                var toml = SchemaSerialization.Serialize(SelectedTool.Schema);
                File.WriteAllText(filePath, toml);
                SelectedTool.IsImportedUnsaved = false;
                AppLogger.Info($"Schema saved: {filePath}");
                MessageBox.Show("Schema saved.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                AppLogger.Error($"Schema save failed: {filePath}", ex);
                MessageBox.Show(
                    $"Failed to save schema: {ex.Message}",
                    "Command Wizard",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
        }

        public void CopyToolToAppDirectory()
        {
            if (SelectedTool == null)
            {
                MessageBox.Show("Select a tool first.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            if (string.IsNullOrWhiteSpace(SelectedTool.ExecutablePath))
            {
                MessageBox.Show("Provide an executable path to copy.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (!File.Exists(SelectedTool.ExecutablePath))
            {
                MessageBox.Show("Executable path not found.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var toolsDir = Path.Combine(AppContext.BaseDirectory, "tools");
            Directory.CreateDirectory(toolsDir);
            var fileName = Path.GetFileName(SelectedTool.ExecutablePath);
            var destination = Path.Combine(toolsDir, fileName);
            File.Copy(SelectedTool.ExecutablePath, destination, overwrite: true);

            SelectedTool.ExecutablePath = destination;
            if (string.IsNullOrWhiteSpace(SelectedTool.InstalledName))
            {
                SelectedTool.InstalledName = Path.GetFileNameWithoutExtension(fileName);
            }

            MessageBox.Show($"Copied to '{destination}'.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        public void AddToolsDirectoryToPath()
        {
            var toolsDir = Path.Combine(AppContext.BaseDirectory, "tools");
            Directory.CreateDirectory(toolsDir);

            var current = Environment.GetEnvironmentVariable("PATH", EnvironmentVariableTarget.User) ?? string.Empty;
            var parts = current.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Any(p => string.Equals(p, toolsDir, StringComparison.OrdinalIgnoreCase)))
            {
                MessageBox.Show("Tools directory is already on PATH (User).", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            var updated = string.IsNullOrWhiteSpace(current) ? toolsDir : $"{current};{toolsDir}";
            Environment.SetEnvironmentVariable("PATH", updated, EnvironmentVariableTarget.User);

            MessageBox.Show("Added tools directory to PATH (User). Restart shells to pick it up.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void LoadSchemas()
        {
            if (!Directory.Exists(_schemaDirectory))
            {
                Directory.CreateDirectory(_schemaDirectory);
                MessageBox.Show(
                    $"Created schema folder at '{_schemaDirectory}'. Add .toml schema files to begin.",
                    "Command Wizard",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);
                return;
            }

            var files = Directory.GetFiles(_schemaDirectory, "*.toml");
            if (files.Length == 0)
            {
                MessageBox.Show(
                    $"No schemas found in '{_schemaDirectory}'. Add at least one .toml file.",
                    "Command Wizard",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);
                return;
            }

            foreach (var file in files)
            {
                try
                {
                    var schema = SchemaSerialization.Parse(File.ReadAllText(file));
                    schema.SourcePath = file;
                    var vm = new ToolSchemaViewModel(schema);
                    RegisterTool(vm);
                    Tools.Add(vm);
                }
                catch (Exception ex)
                {
                    MessageBox.Show(
                        $"Failed to load schema '{Path.GetFileName(file)}': {ex.Message}",
                        "Command Wizard",
                        MessageBoxButton.OK,
                        MessageBoxImage.Warning);
                }
            }

            SelectedTool = Tools.FirstOrDefault();
        }


        public void AddFavoriteFromPaste()
        {
            if (string.IsNullOrWhiteSpace(PasteCommandText))
            {
                MessageBox.Show("Paste a command first.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            AddFavorite(PasteCommandText.Trim());
            PasteCommandText = string.Empty;
            MessageBox.Show("Command saved to favorites.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        public void CopyFavorite(FavoriteCommandViewModel? favorite)
        {
            if (favorite == null || string.IsNullOrWhiteSpace(favorite.Command))
            {
                MessageBox.Show("No command selected.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            Clipboard.SetText(favorite.Command);
            MessageBox.Show("Command copied to clipboard.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        public void RemoveFavorite(FavoriteCommandViewModel? favorite)
        {
            if (favorite == null)
            {
                MessageBox.Show("No command selected.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            Favorites.Remove(favorite);
            SaveFavorites();
            RefreshFavoriteTagFilters();
        }

        public void ClearFavorites()
        {
            if (Favorites.Count == 0)
            {
                MessageBox.Show("No favorites to clear.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            var result = MessageBox.Show(
                "Clear all favorites?",
                "Command Wizard",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (result != MessageBoxResult.Yes)
            {
                return;
            }

            Favorites.Clear();
            SaveFavorites();
            RefreshFavoriteTagFilters();
        }

        public void ExportFavorites()
        {
            if (Favorites.Count == 0)
            {
                MessageBox.Show("No favorites to export.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            var dialog = new Microsoft.Win32.SaveFileDialog
            {
                Title = "Export Favorites",
                Filter = "JSON files (*.json)|*.json|Text files (*.txt)|*.txt|All files (*.*)|*.*",
                FileName = "favorites.json"
            };

            if (dialog.ShowDialog() != true)
            {
                return;
            }

            try
            {
                var filePath = dialog.FileName;
                var extension = Path.GetExtension(filePath);
                if (string.IsNullOrWhiteSpace(extension))
                {
                    filePath = filePath + ".json";
                    extension = ".json";
                }

                if (string.Equals(extension, ".txt", StringComparison.OrdinalIgnoreCase))
                {
                    var lines = new System.Collections.Generic.List<string>();
                    foreach (var favorite in Favorites)
                    {
                        if (!string.IsNullOrWhiteSpace(favorite.Tool))
                        {
                            lines.Add($"# tool: {favorite.Tool}");
                        }
                        if (!string.IsNullOrWhiteSpace(favorite.Action))
                        {
                            lines.Add($"# action: {favorite.Action}");
                        }
                        if (!string.IsNullOrWhiteSpace(favorite.Task))
                        {
                            lines.Add($"# task: {favorite.Task}");
                        }
                        if (!string.IsNullOrWhiteSpace(favorite.CreatedAtLocal))
                        {
                            lines.Add($"# saved: {favorite.CreatedAtLocal}");
                        }
                        lines.Add(favorite.Command ?? string.Empty);
                        lines.Add(string.Empty);
                    }

                    File.WriteAllLines(filePath, lines);
                }
                else
                {
                    var records = Favorites.Select(f => new HistoryRecord
                    {
                        Tool = f.Tool ?? string.Empty,
                        Action = f.Action ?? string.Empty,
                        Task = f.Task ?? string.Empty,
                        Command = f.Command ?? string.Empty,
                        CreatedAtUtc = f.CreatedAtUtc
                    }).ToList();

                    var options = new JsonSerializerOptions { WriteIndented = true };
                    File.WriteAllText(filePath, JsonSerializer.Serialize(records, options));
                }
                MessageBox.Show("Favorites exported.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    $"Failed to export favorites: {ex.Message}",
                    "Command Wizard",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
        }

        private void AddFavorite(string command)
        {
            var record = new FavoriteCommandViewModel
            {
                Tool = SelectedTool?.Schema.Name ?? "",
                Action = SelectedAction?.Name ?? "",
                Task = TaskLabel,
                Command = command,
                CreatedAtUtc = DateTime.UtcNow
            };

            Favorites.Add(record);
            UpdateFavoriteTagsForTool(SelectedTool);
            SaveFavorites();
            RefreshFavoriteTagFilters();
        }

        private void LoadFavorites()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_historyPath) ?? AppContext.BaseDirectory);
                if (!File.Exists(_historyPath))
                {
                    return;
                }

                var json = File.ReadAllText(_historyPath);
                var loaded = JsonSerializer.Deserialize<System.Collections.Generic.List<HistoryRecord>>(json);
                if (loaded == null) return;

                foreach (var record in loaded)
                {
                    var favorite = new FavoriteCommandViewModel
                    {
                        Tool = record.Tool ?? string.Empty,
                        Action = record.Action ?? string.Empty,
                        Task = record.Task ?? string.Empty,
                        Command = record.Command ?? string.Empty,
                        CreatedAtUtc = record.CreatedAtUtc
                    };
                    Favorites.Add(favorite);
                }

                UpdateFavoriteTagsForAll();
            }
            catch (Exception ex)
            {
                AppLogger.Error("Favorites load failed.", ex);
                MessageBox.Show(
                    $"Failed to load favorites: {ex.Message}",
                    "Command Wizard",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
        }

        public void DiscardImportedSchema()
        {
            if (SelectedTool == null || !SelectedTool.IsImportedUnsaved)
            {
                MessageBox.Show("No imported schema to discard.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            var toRemove = SelectedTool;
            Tools.Remove(toRemove);
            SelectedTool = Tools.FirstOrDefault();
            AppLogger.Info("Imported schema discarded.");
            RefreshFavoriteTagFilters();
        }

        public void DeleteSelectedSchema()
        {
            if (SelectedTool == null)
            {
                MessageBox.Show("Select a schema to delete.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            var name = SelectedTool.ToolName;
            var result = MessageBox.Show(
                $"Permanently delete schema '{name}'? This cannot be undone.",
                "Delete Schema",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (result != MessageBoxResult.Yes) return;

            var filePath = SelectedTool.SourcePath;
            var toRemove = SelectedTool;
            Tools.Remove(toRemove);
            SelectedTool = Tools.FirstOrDefault();
            RefreshTagFilters();
            RefreshFavoriteTagFilters();

            if (!string.IsNullOrWhiteSpace(filePath) && File.Exists(filePath))
            {
                try
                {
                    File.Delete(filePath);
                    AppLogger.Info($"Schema deleted: {filePath}");
                    MessageBox.Show($"Schema '{name}' deleted.", "Command Wizard", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    AppLogger.Error($"Schema file delete failed: {filePath}", ex);
                    MessageBox.Show(
                        $"Schema removed from list but file could not be deleted: {ex.Message}",
                        "Command Wizard",
                        MessageBoxButton.OK,
                        MessageBoxImage.Warning);
                }
            }
            else
            {
                AppLogger.Info($"Schema '{name}' removed (unsaved, no file to delete).");
            }
        }

        private static void ApplyImportExclusions(ToolSchema schema, System.Collections.Generic.IEnumerable<string>? excludedFlags)
        {
            if (excludedFlags == null) return;
            var exclude = excludedFlags
                .Where(flag => !string.IsNullOrWhiteSpace(flag))
                .Select(flag => flag.Trim())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (exclude.Count == 0) return;

            var filtered = schema.Arguments.Where(arg =>
                !exclude.Contains(arg.Flag) && (string.IsNullOrWhiteSpace(arg.Long) || !exclude.Contains(arg.Long))).ToList();

            schema.Arguments.Clear();
            foreach (var arg in filtered)
            {
                schema.Arguments.Add(arg);
            }
        }

        private void RegisterTool(ToolSchemaViewModel tool)
        {
            tool.Tags.CollectionChanged += (_, __) => RefreshTagFilters();
            foreach (var tag in tool.Tags)
            {
                tag.PropertyChanged += TagOnPropertyChanged;
            }
            tool.Tags.CollectionChanged += (_, __) =>
            {
                foreach (var tag in tool.Tags)
                {
                    tag.PropertyChanged -= TagOnPropertyChanged;
                    tag.PropertyChanged += TagOnPropertyChanged;
                }
            };
            RefreshTagFilters();
            UpdateFavoriteTagsForTool(tool);
        }

        private void InitializeTagPresets()
        {
            var presets = (List<Models.TagPreset>)TagPresets;
            presets.Clear();

            var neutralShades = new[]
            {
                "#F8F9FA", "#E9ECEF", "#DEE2E6", "#CED4DA", "#ADB5BD",
                "#868E96", "#6C757D", "#495057", "#343A40", "#212529"
            };

            for (var i = 0; i < neutralShades.Length; i++)
            {
                presets.Add(new($"Gray {i + 1}", neutralShades[i]));
            }

            var hues = new (string Name, double Hue, double Saturation)[]
            {
                ("Red", 0, 0.82),
                ("Rose", 340, 0.82),
                ("Pink", 320, 0.76),
                ("Purple", 280, 0.72),
                ("Indigo", 245, 0.70),
                ("Blue", 210, 0.78),
                ("Sky", 195, 0.78),
                ("Cyan", 185, 0.76),
                ("Teal", 170, 0.72),
                ("Green", 130, 0.62),
                ("Lime", 85, 0.66),
                ("Yellow", 60, 0.82),
                ("Amber", 42, 0.86),
                ("Orange", 28, 0.86),
                ("Coral", 14, 0.82),
                ("Brown", 20, 0.42),
                ("Slate", 200, 0.22)
            };

            var shades = new (string Name, double Lightness)[]
            {
                ("100", 0.90),
                ("200", 0.80),
                ("300", 0.70),
                ("400", 0.60),
                ("500", 0.50),
                ("600", 0.40),
                ("700", 0.32),
                ("800", 0.24)
            };

            foreach (var hue in hues)
            {
                foreach (var shade in shades)
                {
                    presets.Add(new($"{hue.Name} {shade.Name}", HslToHex(hue.Hue, hue.Saturation, shade.Lightness)));
                }
            }
        }

        private static string HslToHex(double hue, double saturation, double lightness)
        {
            hue = ((hue % 360) + 360) % 360 / 360;
            var q = lightness < 0.5
                ? lightness * (1 + saturation)
                : lightness + saturation - lightness * saturation;
            var p = 2 * lightness - q;

            byte Convert(double t)
            {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;

                var channel = t switch
                {
                    < 1.0 / 6.0 => p + (q - p) * 6 * t,
                    < 1.0 / 2.0 => q,
                    < 2.0 / 3.0 => p + (q - p) * (2.0 / 3.0 - t) * 6,
                    _ => p
                };

                return (byte)Math.Round(Math.Clamp(channel, 0, 1) * 255);
            }

            var r = Convert(hue + 1.0 / 3.0);
            var g = Convert(hue);
            var b = Convert(hue - 1.0 / 3.0);
            return $"#{r:X2}{g:X2}{b:X2}";
        }

        private void TagOnPropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            RefreshTagFilters();
            UpdateFavoriteTagsForAll();
        }

        private void RefreshTagFilters()
        {
            var current = SelectedTagFilter;
            var tags = Tools
                .SelectMany(t => t.Tags)
                .Select(t => t.Name)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name)
                .ToList();

            TagFilters.Clear();
            TagFilters.Add("All");
            foreach (var tag in tags)
            {
                TagFilters.Add(tag);
            }

            if (!TagFilters.Contains(current))
            {
                SelectedTagFilter = "All";
            }
            else if (SelectedTagFilter != current)
            {
                SelectedTagFilter = current;
            }

            ToolsView.Refresh();
        }

        private void UpdateFavoriteTagsForAll()
        {
            foreach (var tool in Tools)
            {
                UpdateFavoriteTagsForTool(tool);
            }
        }

        private void UpdateFavoriteTagsForTool(ToolSchemaViewModel? tool)
        {
            if (tool == null) return;
            foreach (var favorite in Favorites)
            {
                if (string.Equals(favorite.Tool, tool.ToolName, StringComparison.OrdinalIgnoreCase))
                {
                    favorite.SetTags(tool.Tags);
                }
            }
            RefreshFavoriteTagFilters();
        }

        private void RefreshFavoriteTagFilters()
        {
            var current = SelectedFavoriteTagFilter;
            var tags = Favorites
                .SelectMany(f => f.Tags)
                .Select(t => t.Name)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name)
                .ToList();

            FavoriteTagFilters.Clear();
            FavoriteTagFilters.Add("All");
            foreach (var tag in tags)
            {
                FavoriteTagFilters.Add(tag);
            }

            if (!FavoriteTagFilters.Contains(current))
            {
                SelectedFavoriteTagFilter = "All";
            }
            else if (SelectedFavoriteTagFilter != current)
            {
                SelectedFavoriteTagFilter = current;
            }

            FavoritesView.Refresh();
        }

        private bool FilterFavorite(object item)
        {
            if (item is not FavoriteCommandViewModel favorite) return true;
            var search = FavoriteSearchText?.Trim();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var match = (favorite.Command ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase)
                    || (favorite.Tool ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase)
                    || (favorite.Action ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase)
                    || (favorite.Task ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase);

                if (!match) return false;
            }
            if (!string.IsNullOrWhiteSpace(SelectedFavoriteTagFilter) && SelectedFavoriteTagFilter != "All")
            {
                var hasTag = favorite.Tags.Any(t =>
                    string.Equals(t.Name, SelectedFavoriteTagFilter, StringComparison.OrdinalIgnoreCase));
                if (!hasTag) return false;
            }

            return true;
        }

        private bool FilterTool(object item)
        {
            if (item is not ToolSchemaViewModel tool) return true;

            var search = ToolSearchText?.Trim();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var match = tool.ToolName.Contains(search, StringComparison.OrdinalIgnoreCase)
                    || tool.ToolDescription.Contains(search, StringComparison.OrdinalIgnoreCase)
                    || tool.DisplayName.Contains(search, StringComparison.OrdinalIgnoreCase);

                if (!match) return false;
            }

            if (!string.IsNullOrWhiteSpace(SelectedTagFilter) && SelectedTagFilter != "All")
            {
                var hasTag = tool.Tags.Any(t =>
                    string.Equals(t.Name, SelectedTagFilter, StringComparison.OrdinalIgnoreCase));
                if (!hasTag) return false;
            }

            return true;
        }

        private void AttachToolHandlers(ToolSchemaViewModel? tool)
        {
            if (tool == null) return;
            tool.PropertyChanged += ToolOnPropertyChanged;
            foreach (var option in tool.Options)
            {
                option.PropertyChanged += OptionOnPropertyChanged;
            }
            foreach (var parameter in tool.Parameters)
            {
                parameter.PropertyChanged += ParameterOnPropertyChanged;
            }
        }

        private void DetachToolHandlers(ToolSchemaViewModel? tool)
        {
            if (tool == null) return;
            tool.PropertyChanged -= ToolOnPropertyChanged;
            foreach (var option in tool.Options)
            {
                option.PropertyChanged -= OptionOnPropertyChanged;
            }
            foreach (var parameter in tool.Parameters)
            {
                parameter.PropertyChanged -= ParameterOnPropertyChanged;
            }
        }

        private void OptionOnPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            if (sender is OptionItemViewModel option)
                SyncOptionPart(option);
        }

        private void ParameterOnPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            if (sender is ParameterItemViewModel param)
                SyncParameterPart(param);
        }

        private void ToolOnPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            if (_toolPart != null && _selectedTool != null)
                _toolPart.Value = _selectedTool.CommandName;
            RebuildPreview();
            ToolsView.Refresh();
            UpdateFavoriteTagsForAll();
        }

        private void SaveFavorites()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_historyPath) ?? AppContext.BaseDirectory);
                var records = Favorites.Select(f => new HistoryRecord
                {
                    Tool = f.Tool ?? string.Empty,
                    Action = f.Action ?? string.Empty,
                    Task = f.Task ?? string.Empty,
                    Command = f.Command ?? string.Empty,
                    CreatedAtUtc = f.CreatedAtUtc
                }).ToList();

                var options = new JsonSerializerOptions { WriteIndented = true };
                File.WriteAllText(_historyPath, JsonSerializer.Serialize(records, options));
            }
            catch (Exception ex)
            {
                AppLogger.Error("Favorites save failed.", ex);
                MessageBox.Show(
                    $"Failed to save favorites: {ex.Message}",
                    "Command Wizard",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
        }

        private sealed class HistoryRecord
        {
            public string? Tool { get; set; }
            public string? Action { get; set; }
            public string? Task { get; set; }
            public string? Command { get; set; }
            public DateTime CreatedAtUtc { get; set; }
        }
    }
}
