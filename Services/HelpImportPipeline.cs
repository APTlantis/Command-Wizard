using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Diagnostics;
using System.Text.RegularExpressions;
using CommandWizard.Models;

namespace CommandWizard.Services
{
    public static class HelpImportPipeline
    {
        private static readonly Regex ArgumentLineSplit = new(@"\s+-\s+|\s{2,}", RegexOptions.Compiled);
        private static readonly Regex ActionLineForDraft = new(@"^\s*(?<name>[A-Za-z0-9][A-Za-z0-9_.-]*)(?:\s+[-–—]\s*|\s{2,})(?<desc>.*)$", RegexOptions.Compiled);
        private static readonly Regex UsageTokenForDraft = new(@"[\[<](?<name>[A-Za-z0-9_.-]+)[>\]]", RegexOptions.Compiled);

        private static readonly string[] CompletionProbeArgs =
        {
            "completion powershell",
            "completion bash",
            "completion zsh",
            "completion fish",
            "completions powershell",
            "--generate-completions powershell",
            "--completion powershell"
        };

        public static IHelpImportDraftParser DraftParser { get; set; } = new RegexHelpImportDraftParser();

        public static bool TryCreateDraftFromCommand(string commandName, string helpArgs, bool useAdvancedSources, out HelpImportDraft draft, out string error)
        {
            draft = new HelpImportDraft();
            error = string.Empty;

            if (string.IsNullOrWhiteSpace(commandName))
            {
                error = "Command name is required.";
                return false;
            }

            AppLogger.Info($"Create import draft (command): {commandName} {helpArgs} | advanced={useAdvancedSources}");
            var helpText = HelpSchemaImporter.CaptureHelpText(commandName, helpArgs, out error);
            if (string.IsNullOrWhiteSpace(helpText))
            {
                AppLogger.Error($"Help capture failed: {commandName} {helpArgs}", string.IsNullOrWhiteSpace(error) ? null : new InvalidOperationException(error));
                return false;
            }

            draft = CreateDraft(commandName, helpText, useAdvancedSources);
            return true;
        }

        public static bool TryCreateDraftFromHelpText(string commandName, string helpText, bool useAdvancedSources, out HelpImportDraft draft, out string error)
        {
            draft = new HelpImportDraft();
            error = string.Empty;

            if (string.IsNullOrWhiteSpace(commandName))
            {
                error = "Command name is required.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(helpText))
            {
                error = "Help text is required.";
                return false;
            }

            AppLogger.Info($"Create import draft (paste): {commandName} (len={helpText.Length}) | advanced={useAdvancedSources}");
            draft = CreateDraft(commandName, helpText, useAdvancedSources);
            return true;
        }

        public static HelpImportDraft CreateDraft(string commandName, string helpText, bool useAdvancedSources)
        {
            return DraftParser.CreateDraft(commandName, helpText, useAdvancedSources);
        }

        private static HelpImportDraft CreateRegexDraft(string commandName, string helpText, bool useAdvancedSources)
        {
            var schema = HelpTextParser.Parse(commandName, helpText);
            schema.InstalledName = commandName.Trim();
            schema.ExecutablePath = HelpSchemaImporter.ResolveExecutablePath(commandName.Trim());

            if (useAdvancedSources)
            {
                MergeCompletionData(schema, commandName);
            }

            var draft = new HelpImportDraft
            {
                ToolName = schema.Name,
                Description = schema.Description,
                InstalledName = schema.InstalledName,
                ExecutablePath = schema.ExecutablePath,
                RawHelpText = helpText
            };

            foreach (var action in schema.Actions)
            {
                draft.StagedActions.Add(new SchemaAction
                {
                    Name = action.Name,
                    Description = action.Description
                });
            }

            foreach (var argument in schema.Arguments)
            {
                draft.StagedArguments.Add(new SchemaArgument
                {
                    Flag = argument.Flag,
                    Long = argument.Long,
                    Description = argument.Description,
                    Type = argument.Type,
                    ValueStyle = argument.ValueStyle
                });
            }

            foreach (var parameter in schema.Parameters)
            {
                draft.StagedParameters.Add(new SchemaParameter
                {
                    Name = parameter.Name,
                    Type = parameter.Type,
                    Required = parameter.Required
                });
            }

            if (draft.StagedActions.Count == 0 && draft.StagedArguments.Count == 0)
            {
                draft.ParseWarnings.Add("No actions were detected. Paste command/subcommand lines into the actions bucket if this tool has them.");
            }

            if (draft.StagedArguments.Count == 0 && draft.StagedActions.Count == 0)
            {
                draft.ParseWarnings.Add("No flags or options were detected. Paste option lines into the arguments bucket.");
            }

            return draft;
        }

        public static ToolSchema BuildSchemaFromDraft(HelpImportDraft draft)
        {
            var schema = new ToolSchema
            {
                Name = string.IsNullOrWhiteSpace(draft.ToolName) ? "tool" : draft.ToolName.Trim(),
                Description = draft.Description?.Trim() ?? string.Empty,
                InstalledName = draft.InstalledName?.Trim() ?? string.Empty,
                ExecutablePath = draft.ExecutablePath?.Trim() ?? string.Empty
            };

            foreach (var action in draft.StagedActions.Where(action => !string.IsNullOrWhiteSpace(action.Name)))
            {
                schema.Actions.Add(new SchemaAction
                {
                    Name = action.Name.Trim(),
                    Description = action.Description?.Trim() ?? string.Empty
                });
            }

            foreach (var argument in draft.StagedArguments.Where(argument =>
                         !string.IsNullOrWhiteSpace(argument.Flag) || !string.IsNullOrWhiteSpace(argument.Long)))
            {
                schema.Arguments.Add(new SchemaArgument
                {
                    Flag = argument.Flag?.Trim() ?? string.Empty,
                    Long = argument.Long?.Trim() ?? string.Empty,
                    Description = argument.Description?.Trim() ?? string.Empty,
                    Type = string.IsNullOrWhiteSpace(argument.Type) ? "boolean" : argument.Type.Trim(),
                    ValueStyle = argument.ValueStyle
                });
            }

            foreach (var parameter in draft.StagedParameters.Where(parameter => !string.IsNullOrWhiteSpace(parameter.Name)))
            {
                schema.Parameters.Add(new SchemaParameter
                {
                    Name = parameter.Name.Trim(),
                    Type = string.IsNullOrWhiteSpace(parameter.Type) ? "string" : parameter.Type.Trim(),
                    Required = parameter.Required
                });
            }

            return schema;
        }

        public static void AddActionLines(HelpImportDraft draft, string lines)
        {
            foreach (var line in SplitUserLines(lines))
            {
                var parsed = ParseActionLine(line);
                if (string.IsNullOrWhiteSpace(parsed.Name))
                {
                    draft.ParseWarnings.Add($"Could not parse action line: {line}");
                    continue;
                }

                draft.StagedActions.Add(new SchemaAction
                {
                    Name = parsed.Name,
                    Description = parsed.Description
                });
            }
        }

        public static void AddArgumentLines(HelpImportDraft draft, string lines)
        {
            foreach (var line in SplitUserLines(lines))
            {
                var parsed = ParseArgumentLine(line);
                if (string.IsNullOrWhiteSpace(parsed.Flag) && string.IsNullOrWhiteSpace(parsed.Long))
                {
                    draft.ParseWarnings.Add($"Could not parse argument line: {line}");
                    continue;
                }

                draft.StagedArguments.Add(parsed);
            }
        }

        public static void AddParameterLines(HelpImportDraft draft, string lines)
        {
            foreach (var line in SplitUserLines(lines))
            {
                foreach (var parameter in ParseParameterLine(line))
                {
                    draft.StagedParameters.Add(parameter);
                }
            }
        }

        public static bool TryImportFromCommand(string commandName, string helpArgs, bool useAdvancedSources, out ToolSchema schema, out string error)
        {
            schema = new ToolSchema();
            error = string.Empty;

            if (string.IsNullOrWhiteSpace(commandName))
            {
                error = "Command name is required.";
                return false;
            }

            AppLogger.Info($"Capture help output: {commandName} {helpArgs}");
            var helpText = HelpSchemaImporter.CaptureHelpText(commandName, helpArgs, out error);
            if (string.IsNullOrWhiteSpace(helpText))
            {
                AppLogger.Error($"Help capture failed: {commandName} {helpArgs}", string.IsNullOrWhiteSpace(error) ? null : new InvalidOperationException(error));
                return false;
            }

            schema = HelpTextParser.Parse(commandName, helpText);
            schema.InstalledName = commandName.Trim();
            schema.ExecutablePath = HelpSchemaImporter.ResolveExecutablePath(commandName.Trim());

            if (!useAdvancedSources)
            {
                return true;
            }

            MergeCompletionData(schema, commandName);
            return true;
        }

        public static bool TryImportFromHelpText(string commandName, string helpText, bool useAdvancedSources, out ToolSchema schema, out string error)
        {
            schema = new ToolSchema();
            error = string.Empty;

            if (string.IsNullOrWhiteSpace(commandName))
            {
                error = "Command name is required.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(helpText))
            {
                error = "Help text is required.";
                return false;
            }

            AppLogger.Info($"Parse pasted help text: {commandName} (len={helpText.Length})");
            schema = HelpTextParser.Parse(commandName, helpText);
            schema.InstalledName = commandName.Trim();
            schema.ExecutablePath = HelpSchemaImporter.ResolveExecutablePath(commandName.Trim());

            if (!useAdvancedSources)
            {
                return true;
            }

            MergeCompletionData(schema, commandName);
            return true;
        }

        public static string GetArgumentKey(SchemaArgument argument)
        {
            if (!string.IsNullOrWhiteSpace(argument.Long))
            {
                return argument.Long.Trim();
            }

            var flag = argument.Flag?.Trim() ?? string.Empty;
            return flag;
        }

        private static void MergeCompletionData(ToolSchema schema, string commandName)
        {
            var completion = CaptureCompletionScript(commandName);
            if (string.IsNullOrWhiteSpace(completion))
            {
                AppLogger.Info($"Completion probe skipped (no output): {commandName}");
                return;
            }

            ApplyCompletionText(schema, completion);
        }

        public static void ApplyCompletionText(ToolSchema schema, string completionText)
        {
            var parsed = CompletionScriptParser.Parse(completionText);
            if (parsed.Arguments.Count == 0 && parsed.Actions.Count == 0)
            {
                AppLogger.Info("Completion parse empty.");
                return;
            }

            MergeArguments(schema, parsed.Arguments);
            MergeActions(schema, parsed.Actions);
            AppLogger.Info($"Completion merge: +{parsed.Arguments.Count} args, +{parsed.Actions.Count} actions");
        }

        private static void MergeArguments(ToolSchema schema, IReadOnlyCollection<SchemaArgument> completionArgs)
        {
            var byKey = schema.Arguments.ToDictionary(GetArgumentKey, StringComparer.OrdinalIgnoreCase);

            foreach (var completionArg in completionArgs)
            {
                var key = GetArgumentKey(completionArg);
                if (string.IsNullOrWhiteSpace(key)) continue;

                if (!byKey.TryGetValue(key, out var existing))
                {
                    schema.Arguments.Add(completionArg);
                    byKey[key] = completionArg;
                    continue;
                }

                if (string.IsNullOrWhiteSpace(existing.Long) && !string.IsNullOrWhiteSpace(completionArg.Long))
                {
                    existing.Long = completionArg.Long;
                }

                if (string.IsNullOrWhiteSpace(existing.Flag) && !string.IsNullOrWhiteSpace(completionArg.Flag))
                {
                    existing.Flag = completionArg.Flag;
                }

                if (!string.IsNullOrWhiteSpace(completionArg.Description))
                {
                    if (string.IsNullOrWhiteSpace(existing.Description))
                    {
                        existing.Description = completionArg.Description;
                    }
                    else if (!string.Equals(existing.Description.Trim(), completionArg.Description.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        AppLogger.Warn($"Completion description ignored for {key}: '{completionArg.Description}'");
                    }
                }
            }
        }

        private static IEnumerable<string> SplitUserLines(string lines)
        {
            return (lines ?? string.Empty)
                .Split(new[] { "\r\n", "\n" }, StringSplitOptions.None)
                .Select(line => line.Trim())
                .Where(line => !string.IsNullOrWhiteSpace(line));
        }

        private static (string Name, string Description) ParseActionLine(string line)
        {
            var match = ActionLineForDraft.Match(line);
            if (match.Success)
            {
                return (match.Groups["name"].Value.Trim(), match.Groups["desc"].Value.Trim());
            }

            var parts = line.Split(new[] { ' ', '\t' }, 2, StringSplitOptions.RemoveEmptyEntries);
            return parts.Length switch
            {
                0 => (string.Empty, string.Empty),
                1 => (parts[0].Trim().TrimEnd(','), string.Empty),
                _ => (parts[0].Trim().TrimEnd(','), parts[1].Trim().TrimStart('-', '–', '—').Trim())
            };
        }

        private static SchemaArgument ParseArgumentLine(string line)
        {
            var parts = ArgumentLineSplit.Split(line.Trim(), 2);
            var flagsPart = parts.Length > 0 ? parts[0] : line;
            var description = parts.Length > 1 ? parts[1].Trim().TrimStart('-', '–', '—').Trim() : string.Empty;
            var hasValuePlaceholder = flagsPart.Contains("<", StringComparison.Ordinal) ||
                                      flagsPart.Contains("[", StringComparison.Ordinal) ||
                                      flagsPart.Contains("=", StringComparison.Ordinal);

            var tokens = flagsPart
                .Split(new[] { ' ', '\t', ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(token => token.StartsWith("-", StringComparison.Ordinal) || token.StartsWith("/", StringComparison.Ordinal))
                .Select(CleanFlagToken)
                .ToList();

            var shortFlag = tokens.FirstOrDefault(token => token.StartsWith("-", StringComparison.Ordinal) && !token.StartsWith("--", StringComparison.Ordinal));
            var longFlag = tokens.FirstOrDefault(token => token.StartsWith("--", StringComparison.Ordinal));
            var primary = longFlag ?? shortFlag ?? tokens.FirstOrDefault() ?? string.Empty;

            return new SchemaArgument
            {
                Flag = shortFlag ?? primary,
                Long = shortFlag != null && longFlag != null ? longFlag : string.Empty,
                Description = description,
                Type = hasValuePlaceholder ? "string" : "boolean",
                ValueStyle = flagsPart.Contains("=", StringComparison.Ordinal)
                    ? ArgumentValueStyle.EqualsSeparated
                    : ArgumentValueStyle.SpaceSeparated
            };
        }

        private static string CleanFlagToken(string token)
        {
            var cut = token.IndexOfAny(new[] { '<', '[', '=' });
            return cut > 0 ? token.Substring(0, cut) : token;
        }

        private static IEnumerable<SchemaParameter> ParseParameterLine(string line)
        {
            var matches = UsageTokenForDraft.Matches(line);
            if (matches.Count > 0)
            {
                foreach (Match match in matches)
                {
                    var name = match.Groups["name"].Value.Trim();
                    if (string.IsNullOrWhiteSpace(name) || name.StartsWith("-", StringComparison.Ordinal)) continue;
                    yield return new SchemaParameter
                    {
                        Name = name,
                        Type = "string",
                        Required = line.Contains($"<{name}>", StringComparison.Ordinal)
                    };
                }

                yield break;
            }

            var parts = line.Split(new[] { ' ', '\t' }, 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) yield break;

            yield return new SchemaParameter
            {
                Name = parts[0].Trim().Trim('[', ']', '<', '>', ',', ';'),
                Type = "string",
                Required = !line.TrimStart().StartsWith("[", StringComparison.Ordinal)
            };
        }

        private sealed class RegexHelpImportDraftParser : IHelpImportDraftParser
        {
            public HelpImportDraft CreateDraft(string commandName, string helpText, bool useAdvancedSources)
            {
                return CreateRegexDraft(commandName, helpText, useAdvancedSources);
            }
        }

        private static void MergeActions(ToolSchema schema, IReadOnlyCollection<SchemaAction> completionActions)
        {
            var byName = schema.Actions.ToDictionary(a => a.Name, StringComparer.OrdinalIgnoreCase);

            foreach (var completionAction in completionActions)
            {
                if (string.IsNullOrWhiteSpace(completionAction.Name)) continue;
                if (!byName.TryGetValue(completionAction.Name, out var existing))
                {
                    schema.Actions.Add(completionAction);
                    byName[completionAction.Name] = completionAction;
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(completionAction.Description))
                {
                    if (string.IsNullOrWhiteSpace(existing.Description))
                    {
                        existing.Description = completionAction.Description;
                    }
                    else if (!string.Equals(existing.Description.Trim(), completionAction.Description.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        AppLogger.Warn($"Completion action description ignored for {completionAction.Name}: '{completionAction.Description}'");
                    }
                }
            }
        }

        private static string? CaptureCompletionScript(string commandName)
        {
            foreach (var args in CompletionProbeArgs)
            {
                AppLogger.Info($"Completion probe: {commandName} {args}");
                var output = RunProcess(commandName, args, out var error);
                if (!string.IsNullOrWhiteSpace(output) && IsLikelyCompletionScript(output))
                {
                    AppLogger.Info($"Completion probe success: {commandName} {args}");
                    return output;
                }

                if (!string.IsNullOrWhiteSpace(error))
                {
                    AppLogger.Warn($"Completion probe failed: {commandName} {args} | {error}");
                }
            }

            return null;
        }

        private static bool IsLikelyCompletionScript(string output)
        {
            if (string.IsNullOrWhiteSpace(output)) return false;

            return output.Contains("Register-ArgumentCompleter", StringComparison.OrdinalIgnoreCase) ||
                   output.Contains("complete -", StringComparison.OrdinalIgnoreCase) ||
                   output.Contains("compdef", StringComparison.OrdinalIgnoreCase) ||
                   output.Contains("_arguments", StringComparison.OrdinalIgnoreCase) ||
                   output.Contains("function ", StringComparison.OrdinalIgnoreCase) ||
                   output.Contains("ShellCompDirective", StringComparison.OrdinalIgnoreCase);
        }

        private static string? RunProcess(string commandName, string args, out string error)
        {
            error = string.Empty;
            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = commandName,
                    Arguments = args,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = Process.Start(startInfo);
                if (process == null)
                {
                    error = "Failed to start process.";
                    return null;
                }

                var stdOut = process.StandardOutput.ReadToEnd();
                var stdErr = process.StandardError.ReadToEnd();

                if (!process.WaitForExit(4000))
                {
                    try { process.Kill(entireProcessTree: true); } catch { }
                    error = "Completion command timed out.";
                    return null;
                }

                if (process.ExitCode != 0)
                {
                    error = string.IsNullOrWhiteSpace(stdErr)
                        ? $"Completion command exited with code {process.ExitCode}."
                        : stdErr.Trim();
                    return null;
                }

                var combined = new StringBuilder();
                if (!string.IsNullOrWhiteSpace(stdOut))
                {
                    combined.AppendLine(stdOut.Trim());
                }
                if (!string.IsNullOrWhiteSpace(stdErr))
                {
                    if (combined.Length > 0) combined.AppendLine();
                    combined.AppendLine(stdErr.Trim());
                }

                var output = combined.ToString().Trim();
                if (string.IsNullOrWhiteSpace(output))
                {
                    error = $"Completion output was empty for '{commandName} {args}'.";
                }

                return output;
            }
            catch (Exception ex)
            {
                error = ex.Message;
                AppLogger.Error($"Completion capture exception: {commandName} {args}", ex);
                return null;
            }
        }
    }
}
