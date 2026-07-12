using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using CommandWizard.Models;

namespace CommandWizard.Services
{
    public interface IHelpImportDraftParser
    {
        HelpImportDraft CreateDraft(string commandName, string helpText, bool useAdvancedSources);
    }

    public sealed class HelpImportSectionLabels : INotifyPropertyChanged
    {
        private string _actions = "Actions";
        private string _arguments = "Arguments";
        private string _parameters = "Parameters";

        public event PropertyChangedEventHandler? PropertyChanged;

        public string Actions
        {
            get => _actions;
            set
            {
                if (_actions == value) return;
                _actions = value;
                OnPropertyChanged();
            }
        }

        public string Arguments
        {
            get => _arguments;
            set
            {
                if (_arguments == value) return;
                _arguments = value;
                OnPropertyChanged();
            }
        }

        public string Parameters
        {
            get => _parameters;
            set
            {
                if (_parameters == value) return;
                _parameters = value;
                OnPropertyChanged();
            }
        }

        private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }

    public sealed class HelpImportDraft : INotifyPropertyChanged
    {
        private string _toolName = string.Empty;
        private string _description = string.Empty;
        private string _installedName = string.Empty;
        private string _executablePath = string.Empty;
        private string _rawHelpText = string.Empty;

        public event PropertyChangedEventHandler? PropertyChanged;

        public string ToolName
        {
            get => _toolName;
            set
            {
                if (_toolName == value) return;
                _toolName = value;
                OnPropertyChanged();
            }
        }

        public string Description
        {
            get => _description;
            set
            {
                if (_description == value) return;
                _description = value;
                OnPropertyChanged();
            }
        }

        public string InstalledName
        {
            get => _installedName;
            set
            {
                if (_installedName == value) return;
                _installedName = value;
                OnPropertyChanged();
            }
        }

        public string ExecutablePath
        {
            get => _executablePath;
            set
            {
                if (_executablePath == value) return;
                _executablePath = value;
                OnPropertyChanged();
            }
        }

        public string RawHelpText
        {
            get => _rawHelpText;
            set
            {
                if (_rawHelpText == value) return;
                _rawHelpText = value;
                OnPropertyChanged();
            }
        }

        public HelpImportSectionLabels SectionLabels { get; } = new();
        public ObservableCollection<SchemaAction> StagedActions { get; } = new();
        public ObservableCollection<SchemaArgument> StagedArguments { get; } = new();
        public ObservableCollection<SchemaParameter> StagedParameters { get; } = new();
        public ObservableCollection<string> ParseWarnings { get; } = new();

        private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
