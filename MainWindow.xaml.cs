using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Input;
using CommandWizard.ViewModels;
using System.Windows.Controls;

namespace CommandWizard
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        public static RoutedCommand CopyCommand { get; } = new RoutedCommand();
        public static RoutedCommand GenerateCommand { get; } = new RoutedCommand();
        public static RoutedCommand HelpCommand { get; } = new RoutedCommand();

        private readonly MainViewModel _viewModel;
        private CommandPartViewModel? _draggedChip;

        public MainWindow()
        {
            InitializeComponent();
            _viewModel = new MainViewModel();
            DataContext = _viewModel;
        }

        private void OnCopyExecuted(object sender, ExecutedRoutedEventArgs e)
        {
            _viewModel.CopyCommand();
        }

        private void OnGenerateExecuted(object sender, ExecutedRoutedEventArgs e)
        {
            _viewModel.GenerateCommand();
        }

        private void OnHelpExecuted(object sender, ExecutedRoutedEventArgs e)
        {
            var helpPath = Path.GetFullPath(Path.Combine(
                AppContext.BaseDirectory,
                "..",
                "..",
                "..",
                "..",
                "CommandBuilder",
                "HELP.md"));

            if (!File.Exists(helpPath))
            {
                MessageBox.Show(
                    $"Help file not found at: {helpPath}",
                    "Help",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
                return;
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = helpPath,
                UseShellExecute = true
            });
        }

        private void OnCommandCanExecute(object sender, CanExecuteRoutedEventArgs e)
        {
            if (DataContext is MainViewModel vm)
            {
                e.CanExecute = !string.IsNullOrWhiteSpace(vm.CommandPreview);
                return;
            }

            e.CanExecute = false;
        }

        private void OnSaveSchemaClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.SaveSelectedSchema();
        }

        private void OnNewSchemaClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.AddNewSchema();
        }

        private void OnImportFromHelpClicked(object sender, RoutedEventArgs e)
        {
            try
            {
                var dialog = new ImportHelpWindow { Owner = this };
                if (dialog.ShowDialog() != true)
                {
                    return;
                }

                var imported = dialog.UsePasteText
                    ? _viewModel.ImportSchemaFromHelpText(dialog.CommandText, dialog.HelpText, dialog.UseAdvancedSources, dialog.ExcludedFlags)
                    : _viewModel.ImportSchemaFromHelp(dialog.CommandText, dialog.HelpArgs, dialog.UseAdvancedSources, dialog.ExcludedFlags);

                if (imported)
                {
                    SchemaEditorTab.IsSelected = true;
                }
            }
            catch (System.Exception ex)
            {
                MessageBox.Show(
                    $"Import failed: {ex.Message}",
                    "Import Schema",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
        }

        private void OnAddActionClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.AddAction();
        }

        private void OnRemoveActionClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.RemoveAction();
        }

        private void OnAddArgumentClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.AddArgument();
        }

        private void OnRemoveArgumentClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.RemoveArgument();
        }

        private void OnAddParameterClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.AddParameter();
        }

        private void OnRemoveParameterClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.RemoveParameter();
        }

        private void OnAddTagClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.AddTag();
        }

        private void OnRemoveTagClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.RemoveTag();
        }

        private void OnTagColorSwatchClicked(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement { Tag: string color })
                _viewModel.ApplyTagColor(color);
        }

        private void OnEditOptionClicked(object sender, RoutedEventArgs e)
        {
            if (sender is not FrameworkElement element)
            {
                return;
            }

            if (element.DataContext is not ViewModels.OptionItemViewModel option)
            {
                return;
            }

            var dialog = new OptionEditWindow
            {
                Owner = this,
                Flag = option.Argument.Flag,
                LongFlag = option.Argument.Long,
                Description = option.Argument.Description
            };

            if (dialog.ShowDialog() != true)
            {
                return;
            }

            option.Argument.Flag = dialog.Flag;
            option.Argument.Long = dialog.LongFlag;
            option.Argument.Description = dialog.Description;
        }

        private void OnDiscardImportedClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.DiscardImportedSchema();
        }

        private void OnCopyToolClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.CopyToolToAppDirectory();
        }

        private void OnAddToolsDirToPathClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.AddToolsDirectoryToPath();
        }

        private void OnViewLogClicked(object sender, RoutedEventArgs e)
        {
            var logPath = Services.AppLogger.LogPath;
            if (!File.Exists(logPath))
            {
                MessageBox.Show(
                    $"No log file found yet. It will appear after the first import or save.\n\nPath: {logPath}",
                    "Command Wizard",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);
                return;
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = logPath,
                UseShellExecute = true
            });
        }

        private void OnExitClicked(object sender, RoutedEventArgs e)
        {
            Close();
        }

        private void OnAboutClicked(object sender, RoutedEventArgs e)
        {
            MessageBox.Show(
                "Aptlantis Command Wizard\nSchema-driven command builder.",
                "About",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
        }

        private void OnAddFavoriteClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.AddFavoriteFromPaste();
        }

        private void OnCopyFavoriteClicked(object sender, RoutedEventArgs e)
        {
            if (sender is not FrameworkElement element)
            {
                return;
            }

            if (element.DataContext is not ViewModels.FavoriteCommandViewModel favorite)
            {
                return;
            }

            _viewModel.CopyFavorite(favorite);
        }

        private void OnRemoveFavoriteClicked(object sender, RoutedEventArgs e)
        {
            if (sender is not FrameworkElement element)
            {
                return;
            }

            if (element.DataContext is not ViewModels.FavoriteCommandViewModel favorite)
            {
                return;
            }

            _viewModel.RemoveFavorite(favorite);
        }

        private void OnClearFavoritesClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.ClearFavorites();
        }

        private void OnExportFavoritesClicked(object sender, RoutedEventArgs e)
        {
            _viewModel.ExportFavorites();
        }

        private void OnChipDragHandleMouseDown(object sender, MouseButtonEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.DataContext is CommandPartViewModel vm && vm.IsRemovable)
            {
                _draggedChip = vm;
                DragDrop.DoDragDrop(elem, vm, DragDropEffects.Move);
                e.Handled = true;
            }
        }

        private void OnChipDrop(object sender, DragEventArgs e)
        {
            if (_draggedChip == null) return;
            if (sender is FrameworkElement target && target.DataContext is CommandPartViewModel targetVm && targetVm != _draggedChip)
            {
                var parts = _viewModel.CommandParts;
                var fromIdx = parts.IndexOf(_draggedChip);
                var toIdx = parts.IndexOf(targetVm);
                if (fromIdx >= 0 && toIdx >= 0)
                    _viewModel.MoveCommandPart(fromIdx, toIdx);
            }
            _draggedChip = null;
            e.Handled = true;
        }

        private void OnChipDragOver(object sender, DragEventArgs e)
        {
            e.Effects = _draggedChip != null ? DragDropEffects.Move : DragDropEffects.None;
            e.Handled = true;
        }
    }
}
