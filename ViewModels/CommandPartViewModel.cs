using System;
using System.Collections.Generic;
using System.Windows.Input;
using System.Windows.Media;
using CommandWizard.Models;

namespace CommandWizard.ViewModels
{
    public sealed class CommandPartViewModel : ViewModelBase
    {
        private static readonly Dictionary<CommandPartRole, Brush> RoleColors = new()
        {
            [CommandPartRole.Tool] = Freeze(new SolidColorBrush(Color.FromRgb(0x1E, 0x88, 0xE5))),
            [CommandPartRole.Action] = Freeze(new SolidColorBrush(Color.FromRgb(0x8E, 0x24, 0xAA))),
            [CommandPartRole.Argument] = Freeze(new SolidColorBrush(Color.FromRgb(0x2E, 0x7D, 0x32))),
            [CommandPartRole.ArgumentValue] = Freeze(new SolidColorBrush(Color.FromRgb(0xE6, 0x5C, 0x00))),
            [CommandPartRole.Parameter] = Freeze(new SolidColorBrush(Color.FromRgb(0x37, 0x47, 0x4F)))
        };

        private string _value;
        private bool _hasWarning;
        private string? _warningMessage;

        public CommandPartViewModel(CommandPart part, Action<CommandPartViewModel> onRemove)
        {
            Part = part;
            _value = part.Token;
            RemoveCommand = new DelegateCommand(() => onRemove(this));
        }

        public CommandPart Part { get; }
        public Guid Id => Part.Id;
        public CommandPartRole Role => Part.Role;
        public bool IsFixed => Part.IsFixed;
        public bool IsRemovable => !Part.IsFixed && Role != CommandPartRole.ArgumentValue;
        public bool ShowValueInput => Role is CommandPartRole.ArgumentValue or CommandPartRole.Parameter;

        public string Value
        {
            get => _value;
            set
            {
                if (_value == value) return;
                _value = value;
                Part.Token = value;
                OnPropertyChanged();
                ValueChanged?.Invoke(this, EventArgs.Empty);
            }
        }

        public bool HasWarning
        {
            get => _hasWarning;
            set { if (_hasWarning == value) return; _hasWarning = value; OnPropertyChanged(); }
        }

        public string? WarningMessage
        {
            get => _warningMessage;
            set { if (_warningMessage == value) return; _warningMessage = value; OnPropertyChanged(); }
        }

        public string RoleBadgeText => Role switch
        {
            CommandPartRole.Tool => "cmd",
            CommandPartRole.Action => "sub",
            CommandPartRole.Argument => "flag",
            CommandPartRole.ArgumentValue => "val",
            CommandPartRole.Parameter => "arg",
            _ => "?"
        };

        public Brush RoleBadgeColor => RoleColors.TryGetValue(Role, out var b) ? b : Brushes.Gray;

        public event EventHandler? ValueChanged;
        public ICommand RemoveCommand { get; }

        private static Brush Freeze(SolidColorBrush b) { b.Freeze(); return b; }
    }
}
