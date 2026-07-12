using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using CommandWizard.Models;
using CommandWizard.Services;

namespace CommandWizard
{
    public partial class ImportHelpWindow : Window, INotifyPropertyChanged
    {
        private string _commandText = string.Empty;
        private string _helpArgs = "--help";
        private bool _usePasteText;
        private bool _useAdvancedSources = true;
        private HelpImportDraft _draft = new();
        private SchemaAction? _selectedAction;
        private SchemaArgument? _selectedArgument;
        private SchemaParameter? _selectedParameter;

        public ImportHelpWindow()
        {
            InitializeComponent();
            DataContext = this;
            Loaded += OnLoaded;
        }

        public event PropertyChangedEventHandler? PropertyChanged;

        public string CommandText
        {
            get => _commandText;
            set
            {
                if (_commandText == value) return;
                _commandText = value;
                OnPropertyChanged();
            }
        }

        public string HelpArgs
        {
            get => _helpArgs;
            set
            {
                if (_helpArgs == value) return;
                _helpArgs = value;
                OnPropertyChanged();
            }
        }

        public bool UsePasteText
        {
            get => _usePasteText;
            private set
            {
                if (_usePasteText == value) return;
                _usePasteText = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(IsRunMode));
            }
        }

        public bool IsRunMode => !UsePasteText;

        public bool UseAdvancedSources
        {
            get => _useAdvancedSources;
            set
            {
                if (_useAdvancedSources == value) return;
                _useAdvancedSources = value;
                OnPropertyChanged();
            }
        }

        public HelpImportDraft Draft
        {
            get => _draft;
            private set
            {
                if (_draft == value) return;
                _draft = value;
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
            }
        }

        public SchemaArgument? SelectedArgument
        {
            get => _selectedArgument;
            set
            {
                if (_selectedArgument == value) return;
                _selectedArgument = value;
                OnPropertyChanged();
            }
        }

        public SchemaParameter? SelectedParameter
        {
            get => _selectedParameter;
            set
            {
                if (_selectedParameter == value) return;
                _selectedParameter = value;
                OnPropertyChanged();
            }
        }

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            SetImportMode(false);
        }

        private void OnCancelClicked(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
        }

        private void OnImportClicked(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(Draft.ToolName))
            {
                MessageBox.Show("Tool name is required before importing.", "Import Schema", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            DialogResult = true;
        }

        private void OnLoadDraftClicked(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(CommandText))
            {
                MessageBox.Show("Command name is required.", "Import Schema", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var ok = UsePasteText
                ? HelpImportPipeline.TryCreateDraftFromHelpText(CommandText, Draft.RawHelpText, UseAdvancedSources, out var draft, out var error)
                : HelpImportPipeline.TryCreateDraftFromCommand(CommandText, HelpArgs, UseAdvancedSources, out draft, out error);

            if (!ok)
            {
                var message = string.IsNullOrWhiteSpace(error) ? "Could not create an import draft." : error;
                MessageBox.Show(message, "Import Schema", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            Draft = draft;
            SelectedAction = null;
            SelectedArgument = null;
            SelectedParameter = null;
        }

        private void OnRunModeChecked(object sender, RoutedEventArgs e)
        {
            SetImportMode(false);
        }

        private void OnPasteModeChecked(object sender, RoutedEventArgs e)
        {
            SetImportMode(true);
        }

        private void SetImportMode(bool usePaste)
        {
            UsePasteText = usePaste;
        }

        private void OnAddActionClicked(object sender, RoutedEventArgs e)
        {
            var action = new SchemaAction { Name = "action", Description = string.Empty };
            Draft.StagedActions.Add(action);
            SelectedAction = action;
        }

        private void OnRemoveActionClicked(object sender, RoutedEventArgs e)
        {
            if (SelectedAction == null) return;
            Draft.StagedActions.Remove(SelectedAction);
            SelectedAction = null;
        }

        private void OnPasteActionLinesClicked(object sender, RoutedEventArgs e)
        {
            HelpImportPipeline.AddActionLines(Draft, GetClipboardText());
        }

        private void OnAddArgumentClicked(object sender, RoutedEventArgs e)
        {
            var argument = new SchemaArgument { Flag = "--flag", Type = "boolean" };
            Draft.StagedArguments.Add(argument);
            SelectedArgument = argument;
        }

        private void OnRemoveArgumentClicked(object sender, RoutedEventArgs e)
        {
            if (SelectedArgument == null) return;
            Draft.StagedArguments.Remove(SelectedArgument);
            SelectedArgument = null;
        }

        private void OnPasteArgumentLinesClicked(object sender, RoutedEventArgs e)
        {
            HelpImportPipeline.AddArgumentLines(Draft, GetClipboardText());
        }

        private void OnAddParameterClicked(object sender, RoutedEventArgs e)
        {
            var parameter = new SchemaParameter { Name = "input", Type = "string", Required = true };
            Draft.StagedParameters.Add(parameter);
            SelectedParameter = parameter;
        }

        private void OnRemoveParameterClicked(object sender, RoutedEventArgs e)
        {
            if (SelectedParameter == null) return;
            Draft.StagedParameters.Remove(SelectedParameter);
            SelectedParameter = null;
        }

        private void OnPasteParameterLinesClicked(object sender, RoutedEventArgs e)
        {
            HelpImportPipeline.AddParameterLines(Draft, GetClipboardText());
        }

        private static string GetClipboardText()
        {
            if (!Clipboard.ContainsText())
            {
                MessageBox.Show("Clipboard does not contain text.", "Import Schema", MessageBoxButton.OK, MessageBoxImage.Information);
                return string.Empty;
            }

            return Clipboard.GetText();
        }

        private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
