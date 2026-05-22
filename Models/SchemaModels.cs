using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Media;

namespace CommandWizard.Models
{
    public enum ArgumentValueStyle
    {
        SpaceSeparated,
        EqualsSeparated,
        Attached
    }

    public sealed record TagPreset(string Name, string Color)
    {
        public Brush Brush { get; } = new SolidColorBrush(
            (System.Windows.Media.Color)ColorConverter.ConvertFromString(Color));
    }


    public sealed class ToolSchema
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;
        public string SourcePath { get; set; } = string.Empty;
        public string ExecutablePath { get; set; } = string.Empty;
        public string InstalledName { get; set; } = string.Empty;
        public ObservableCollection<SchemaAction> Actions { get; set; } = new();
        public ObservableCollection<SchemaArgument> Arguments { get; set; } = new();
        public ObservableCollection<SchemaParameter> Parameters { get; set; } = new();
        public ObservableCollection<SchemaTag> Tags { get; set; } = new();
    }

    public sealed class SchemaTag : INotifyPropertyChanged
    {
        private string _name = string.Empty;
        private string _color = "#7A7A7A";

        public event PropertyChangedEventHandler? PropertyChanged;

        public string Name
        {
            get => _name;
            set
            {
                if (_name == value) return;
                _name = value;
                OnPropertyChanged();
            }
        }

        public string Color
        {
            get => _color;
            set
            {
                if (_color == value) return;
                _color = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(ColorBrush));
            }
        }

        public Brush ColorBrush => TryGetBrush(Color) ?? Brushes.Gray;

        private static Brush? TryGetBrush(string color)
        {
            if (string.IsNullOrWhiteSpace(color)) return null;
            try
            {
                var converted = ColorConverter.ConvertFromString(color);
                if (converted is Color parsed)
                {
                    return new SolidColorBrush(parsed);
                }
            }
            catch
            {
            }

            return null;
        }

        private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }

    public sealed class SchemaAction : INotifyPropertyChanged
    {
        private string _name = string.Empty;
        private string _description = string.Empty;

        public event PropertyChangedEventHandler? PropertyChanged;

        public string Name
        {
            get => _name;
            set
            {
                if (_name == value) return;
                _name = value;
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

        public ObservableCollection<SchemaArgument> Arguments { get; set; } = new();
        public ObservableCollection<SchemaParameter> Parameters { get; set; } = new();

        private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }

    public sealed class SchemaArgument : INotifyPropertyChanged
    {
        private string _flag = string.Empty;
        private string _long = string.Empty;
        private string _description = string.Empty;
        private string _type = "boolean";
        private ArgumentValueStyle _valueStyle = ArgumentValueStyle.SpaceSeparated;

        public event PropertyChangedEventHandler? PropertyChanged;

        public string Flag
        {
            get => _flag;
            set
            {
                if (_flag == value) return;
                _flag = value;
                OnPropertyChanged();
            }
        }

        public string Long
        {
            get => _long;
            set
            {
                if (_long == value) return;
                _long = value;
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

        public string Type
        {
            get => _type;
            set
            {
                if (_type == value) return;
                _type = value;
                OnPropertyChanged();
            }
        }

        public ArgumentValueStyle ValueStyle
        {
            get => _valueStyle;
            set
            {
                if (_valueStyle == value) return;
                _valueStyle = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(ValueStyleText));
            }
        }

        public string ValueStyleText
        {
            get => _valueStyle switch
            {
                ArgumentValueStyle.EqualsSeparated => "equals",
                ArgumentValueStyle.Attached => "attached",
                _ => "space"
            };
            set => ValueStyle = value?.ToLowerInvariant() switch
            {
                "equals" or "equals_separated" => ArgumentValueStyle.EqualsSeparated,
                "attached" => ArgumentValueStyle.Attached,
                _ => ArgumentValueStyle.SpaceSeparated
            };
        }

        private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }

    public sealed class SchemaParameter : INotifyPropertyChanged
    {
        private string _name = string.Empty;
        private string _type = "string";
        private bool _required = true;

        public event PropertyChangedEventHandler? PropertyChanged;

        public string Name
        {
            get => _name;
            set
            {
                if (_name == value) return;
                _name = value;
                OnPropertyChanged();
            }
        }

        public string Type
        {
            get => _type;
            set
            {
                if (_type == value) return;
                _type = value;
                OnPropertyChanged();
            }
        }

        public bool Required
        {
            get => _required;
            set
            {
                if (_required == value) return;
                _required = value;
                OnPropertyChanged();
            }
        }

        private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
