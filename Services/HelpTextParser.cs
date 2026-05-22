using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using CommandWizard.Models;

namespace CommandWizard.Services
{
    public static class HelpTextParser
    {
        private static readonly Regex FlagLine = new(@"^\s*(?<flags>(?:[-/][^\s]*(?:\s*,\s*[-/][^\s]*)*)(?:\s+[-/][^\s]*(?:\s*,\s*[-/][^\s]*)*)*)\s+(?<desc>.+)$", RegexOptions.Compiled);
        private static readonly Regex FlagOnlyLine = new(@"^\s*(?<flags>(?:[-/][^\s]*(?:\s*,\s*[-/][^\s]*)*)(?:\s+[-/][^\s]*(?:\s*,\s*[-/][^\s]*)*)*)\s*$", RegexOptions.Compiled);
        private static readonly Regex SectionHeader = new(@"^\s*(?<header>[\w\s]+):\s*$", RegexOptions.Compiled);
        private static readonly Regex ActionLine = new(@"^\s*(?<cmds>[\w-]+(?:\s*,\s*[\w-]+)*)\s+(?<desc>.+)$", RegexOptions.Compiled);
        private static readonly Regex GitCommandsIntro = new(@"common\s+git\s+commands", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly HashSet<string> CommandSectionHeaders = new(StringComparer.OrdinalIgnoreCase)
        {
            "commands",
            "subcommands"
        };
        private static readonly HashSet<string> OptionSectionHeaders = new(StringComparer.OrdinalIgnoreCase)
        {
            "options",
            "global options",
            "flags",
            "global flags",
            "arguments",
            "cache options",
            "python options",
            "general options",
            "connection options",
            "ssl options"
        };

        public static ToolSchema Parse(string commandName, string helpText)
        {
            var schema = new ToolSchema
            {
                Name = string.IsNullOrWhiteSpace(commandName) ? "tool" : commandName.Trim(),
                Description = "",
                InstalledName = commandName.Trim()
            };

            var lines = helpText
                .Split(new[] { "\r\n", "\n" }, StringSplitOptions.None)
                .Select(line => NormalizeHelpLine(line.TrimEnd()))
                .ToList();

            schema.Description = InferDescription(lines);

            var actions = ParseActions(lines);
            foreach (var action in actions)
            {
                schema.Actions.Add(action);
            }

            var parameters = ParseParametersFromUsage(commandName, lines, actions);
            foreach (var parameter in parameters)
            {
                schema.Parameters.Add(parameter);
            }

            var arguments = ParseArguments(lines);
            foreach (var argument in arguments)
            {
                schema.Arguments.Add(argument);
            }

            return schema;
        }

        private static string InferDescription(IReadOnlyList<string> lines)
        {
            foreach (var line in lines)
            {
                var trimmed = line.Trim();
                if (string.IsNullOrWhiteSpace(trimmed)) continue;
                if (trimmed.StartsWith("Usage", StringComparison.OrdinalIgnoreCase)) continue;
                if (trimmed.EndsWith(":", StringComparison.Ordinal)) continue;
                return trimmed;
            }

            return string.Empty;
        }

        private static IEnumerable<SchemaAction> ParseActions(IReadOnlyList<string> lines)
        {
            var actions = new List<SchemaAction>();
            var inCommands = false;

            foreach (var raw in lines)
            {
                var line = raw.TrimEnd();
                if (string.IsNullOrWhiteSpace(line))
                {
                    continue;
                }

                if (IsCommandsIntro(line))
                {
                    inCommands = true;
                    continue;
                }

                if (!inCommands && GitCommandsIntro.IsMatch(line))
                {
                    inCommands = true;
                    continue;
                }

                if (inCommands && IsOptionsIntro(line))
                {
                    inCommands = false;
                    continue;
                }

                var section = SectionHeader.Match(line);
                if (section.Success)
                {
                    var header = section.Groups["header"].Value.Trim().ToLowerInvariant();
                    if (IsCommandSectionHeader(header))
                    {
                        inCommands = true;
                        continue;
                    }

                    if (inCommands)
                    {
                        inCommands = false;
                    }
                    continue;
                }

                if (!inCommands) continue;

                var wasIndented = IsIndented(line);
                var trimmed = CleanActionLine(line.Trim());
                if (trimmed.StartsWith("-", StringComparison.Ordinal)) continue;
                if (trimmed.StartsWith("usage:", StringComparison.OrdinalIgnoreCase)) continue;
                if (IsLikelyDecorativeSectionLine(trimmed, wasIndented)) continue;

                var multiColumnActions = ParseMultiColumnActions(trimmed);
                if (multiColumnActions.Count > 1)
                {
                    actions.AddRange(multiColumnActions.Select(name => new SchemaAction { Name = name }));
                    continue;
                }

                var actionMatch = ActionLine.Match(trimmed);
                if (actionMatch.Success)
                {
                    AddActionFromMatch(actions, actionMatch);
                    continue;
                }

                AppLogger.Warn($"Unparsed command line: '{trimmed}'");
                var parts = trimmed.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 0) continue;

                var fallbackName = parts[0].Trim().TrimEnd(',');
                if (string.IsNullOrWhiteSpace(fallbackName)) continue;

                var fallbackDescription = trimmed.Length > fallbackName.Length
                    ? trimmed.Substring(fallbackName.Length).Trim()
                    : string.Empty;

                if (IsLikelyActionNoise(fallbackName, fallbackDescription)) continue;

                actions.Add(new SchemaAction
                {
                    Name = fallbackName,
                    Description = fallbackDescription
                });
            }

            return actions;
        }

        private static void AddActionFromMatch(ICollection<SchemaAction> actions, Match actionMatch)
        {
            var cmds = actionMatch.Groups["cmds"].Value;
            var description = actionMatch.Groups["desc"].Value.Trim();
            var aliases = cmds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            if (aliases.Count == 0) return;

            var name = aliases[0];
            if (IsLikelyActionNoise(name, description)) return;

            if (aliases.Count > 1)
            {
                var aliasText = string.Join(", ", aliases.Skip(1));
                description = string.IsNullOrWhiteSpace(description)
                    ? $"Aliases: {aliasText}"
                    : $"{description} (Aliases: {aliasText})";
            }

            actions.Add(new SchemaAction
            {
                Name = name,
                Description = description
            });
        }

        private static bool IsCommandsIntro(string line)
        {
            var trimmed = line.Trim();
            return trimmed.Contains("commands are available", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Contains("available commands", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.StartsWith("Commands:", StringComparison.OrdinalIgnoreCase) ||
                   IsBareCommandsHeader(trimmed) ||
                   trimmed.Contains("<command> --help", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsBareCommandsHeader(string trimmed)
        {
            if (!trimmed.EndsWith("commands", StringComparison.OrdinalIgnoreCase)) return false;
            if (trimmed.Contains("  ", StringComparison.Ordinal)) return false;
            var words = trimmed.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
            return words.Length <= 3;
        }

        private static bool IsCommandSectionHeader(string header)
        {
            return CommandSectionHeaders.Contains(header) ||
                   header.EndsWith("commands", StringComparison.OrdinalIgnoreCase) ||
                   header.EndsWith("subcommands", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsOptionsIntro(string line)
        {
            var trimmed = line.Trim();
            return trimmed.Contains("options are available", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.StartsWith("Options:", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.StartsWith("Global Options:", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.StartsWith("Flags:", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.EndsWith("options:", StringComparison.OrdinalIgnoreCase);
        }

        private static string NormalizeHelpLine(string line)
        {
            if (string.IsNullOrEmpty(line)) return line;
            var chars = line.Select(ch => ch <= 127 ? ch : ' ').ToArray();
            return new string(chars);
        }

        private static string CleanActionLine(string line)
        {
            return line.Trim().Trim(',', '|', '"', '\'').Trim();
        }

        private static bool IsLikelyDecorativeSectionLine(string line, bool wasIndented)
        {
            if (string.IsNullOrWhiteSpace(line)) return true;
            if (line.EndsWith(":", StringComparison.Ordinal)) return true;
            if (!wasIndented && line.Contains("(see also:", StringComparison.OrdinalIgnoreCase)) return true;
            if (!wasIndented && line.Contains(", ", StringComparison.Ordinal) && !line.Contains("  ", StringComparison.Ordinal)) return true;
            if (line.Contains("help", StringComparison.OrdinalIgnoreCase) &&
                line.Contains("command", StringComparison.OrdinalIgnoreCase) &&
                line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries).Length > 3)
            {
                return true;
            }

            if (line.Contains("commands (", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            return false;
        }

        private static bool IsLikelyActionNoise(string name, string description)
        {
            if (string.IsNullOrWhiteSpace(name)) return true;
            if (!IsLikelyActionName(name)) return true;

            if (description.StartsWith("& ", StringComparison.Ordinal))
            {
                return true;
            }

            var hasUppercase = name.Any(char.IsUpper);
            if (hasUppercase && !name.Contains('-', StringComparison.Ordinal) && !name.Contains('_', StringComparison.Ordinal))
            {
                var descriptionWords = description.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                if (descriptionWords.Length <= 3)
                {
                    return true;
                }
            }

            return false;
        }

        private static List<string> ParseMultiColumnActions(string line)
        {
            var columns = Regex.Split(line.Trim(), @"\s{2,}")
                .Select(column => column.Trim())
                .Where(column => !string.IsNullOrWhiteSpace(column))
                .ToList();

            if (columns.Count <= 1 || columns.Any(column => !IsLikelyActionName(column)))
            {
                return new List<string>();
            }

            return columns.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }

        private static bool IsLikelyActionName(string token)
        {
            if (string.IsNullOrWhiteSpace(token)) return false;
            if (token.StartsWith("-", StringComparison.Ordinal) || token.StartsWith("/", StringComparison.Ordinal)) return false;
            if (token.Any(ch => !char.IsLetterOrDigit(ch) && ch != '-' && ch != '_' && ch != '.')) return false;
            return true;
        }

        private static IEnumerable<SchemaArgument> ParseArguments(IReadOnlyList<string> lines)
        {
            var arguments = new List<SchemaArgument>();
            var byKey = new Dictionary<string, SchemaArgument>(StringComparer.OrdinalIgnoreCase);
            SchemaArgument? lastArgument = null;

            foreach (var line in lines)
            {
                if (string.IsNullOrWhiteSpace(line))
                {
                    lastArgument = null;
                    continue;
                }

                if (SectionHeader.IsMatch(line))
                {
                    lastArgument = null;
                    continue;
                }

                var match = FlagLine.Match(line);
                if (!match.Success)
                {
                    var flagOnlyArgument = ParseFlagOnlyArgument(line);
                    if (flagOnlyArgument != null)
                    {
                        var flagOnlyKey = GetArgumentKey(flagOnlyArgument);
                        if (!byKey.ContainsKey(flagOnlyKey))
                        {
                            byKey[flagOnlyKey] = flagOnlyArgument;
                            arguments.Add(flagOnlyArgument);
                        }

                        lastArgument = byKey[flagOnlyKey];
                    }
                    else if (lastArgument != null && IsIndented(line))
                    {
                        var continuation = line.Trim();
                        if (!string.IsNullOrWhiteSpace(continuation))
                        {
                            lastArgument.Description = string.IsNullOrWhiteSpace(lastArgument.Description)
                                ? continuation
                                : $"{lastArgument.Description} {continuation}";
                        }
                    }
                    else if (line.TrimStart().StartsWith("-", StringComparison.Ordinal) || line.TrimStart().StartsWith("/", StringComparison.Ordinal))
                    {
                        AppLogger.Warn($"Unparsed option line: '{line.Trim()}'");
                    }
                    continue;
                }

                var flagsPart = match.Groups["flags"].Value;
                var description = match.Groups["desc"].Value.Trim();
                var flagTokens = flagsPart
                    .Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)
                    .SelectMany(token => token.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    .SelectMany(token => token.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrWhiteSpace(f))
                    .ToList();

                PromoteLeadingDescriptionFlag(flagTokens, ref description);
                NormalizeValuePlaceholder(flagTokens, ref description, out var valueStyleFromDescription);
                var shortFlag = flagTokens.FirstOrDefault(f => f.StartsWith("-", StringComparison.Ordinal) && !f.StartsWith("--", StringComparison.Ordinal));
                var longFlag = flagTokens.FirstOrDefault(f => f.StartsWith("--", StringComparison.Ordinal));

                var primary = longFlag ?? shortFlag ?? flagTokens.FirstOrDefault();
                if (string.IsNullOrWhiteSpace(primary)) continue;

                var type = InferArgumentType(flagTokens);
                if (valueStyleFromDescription || HasLooseValueToken(flagTokens))
                {
                    type = "string";
                }

                var key = longFlag ?? primary;

                if (byKey.TryGetValue(key, out var existing))
                {
                    if (string.IsNullOrWhiteSpace(existing.Long) && !string.IsNullOrWhiteSpace(longFlag))
                    {
                        existing.Long = longFlag;
                    }

                    if (string.IsNullOrWhiteSpace(existing.Flag) && !string.IsNullOrWhiteSpace(shortFlag))
                    {
                        existing.Flag = shortFlag;
                    }

                    if (!string.IsNullOrWhiteSpace(description) &&
                        (string.IsNullOrWhiteSpace(existing.Description) || description.Length > existing.Description.Length))
                    {
                        existing.Description = description;
                    }

                    lastArgument = existing;
                    continue;
                }

                var argument = new SchemaArgument
                {
                    Flag = shortFlag ?? longFlag ?? primary,
                    Long = shortFlag != null && longFlag != null ? longFlag : "",
                    Description = description,
                    Type = type,
                    ValueStyle = flagTokens.Any(token => token.Contains("=", StringComparison.Ordinal) || token.Contains(":", StringComparison.Ordinal))
                        ? ArgumentValueStyle.EqualsSeparated
                        : ArgumentValueStyle.SpaceSeparated
                };

                byKey[key] = argument;
                arguments.Add(argument);
                lastArgument = argument;
            }

            return arguments;
        }

        private static string GetArgumentKey(SchemaArgument argument)
        {
            if (!string.IsNullOrWhiteSpace(argument.Long)) return argument.Long;
            return argument.Flag;
        }

        private static SchemaArgument? ParseFlagOnlyArgument(string line)
        {
            var match = FlagOnlyLine.Match(line);
            if (!match.Success) return null;

            var flagTokens = match.Groups["flags"].Value
                .Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .SelectMany(token => token.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                .SelectMany(token => token.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                .Select(token => token.Trim())
                .Where(token => token.StartsWith("-", StringComparison.Ordinal) || token.StartsWith("/", StringComparison.Ordinal))
                .ToList();

            if (flagTokens.Count == 0) return null;

            var shortFlag = flagTokens.FirstOrDefault(f => f.StartsWith("-", StringComparison.Ordinal) && !f.StartsWith("--", StringComparison.Ordinal));
            var longFlag = flagTokens.FirstOrDefault(f => f.StartsWith("--", StringComparison.Ordinal));
            var primary = longFlag ?? shortFlag ?? flagTokens.First();

            return new SchemaArgument
            {
                Flag = shortFlag ?? primary,
                Long = shortFlag != null && longFlag != null ? longFlag : "",
                Type = InferArgumentType(flagTokens)
            };
        }

        private static void NormalizeValuePlaceholder(IList<string> flagTokens, ref string description, out bool foundValuePlaceholder)
        {
            foundValuePlaceholder = false;
            if (flagTokens.Count == 0 || string.IsNullOrWhiteSpace(description)) return;

            var parts = description.Split(new[] { ' ', '\t' }, 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) return;

            var first = parts[0].Trim();
            if (!IsLooseValueToken(first)) return;

            foundValuePlaceholder = true;
            description = parts.Length > 1 ? parts[1].Trim() : string.Empty;
        }

        private static void PromoteLeadingDescriptionFlag(ICollection<string> flagTokens, ref string description)
        {
            if (string.IsNullOrWhiteSpace(description)) return;

            var parts = description.Split(new[] { ' ', '\t' }, 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) return;

            var maybeFlag = parts[0].Trim().TrimEnd(',');
            if (!maybeFlag.StartsWith("-", StringComparison.Ordinal) && !maybeFlag.StartsWith("/", StringComparison.Ordinal))
            {
                return;
            }

            flagTokens.Add(maybeFlag);
            description = parts.Length > 1 ? parts[1].Trim() : string.Empty;
        }

        private static bool HasLooseValueToken(IEnumerable<string> flagTokens)
        {
            return flagTokens.Any(token =>
            {
                var parts = token.Split(':', 2);
                return parts.Length == 2 && IsLooseValueToken(parts[1]);
            });
        }

        private static bool IsLooseValueToken(string token)
        {
            var cleaned = token.Trim().Trim(',', ';', ')', '(');
            if (string.IsNullOrWhiteSpace(cleaned)) return false;
            if (cleaned.StartsWith("<", StringComparison.Ordinal) || cleaned.StartsWith("[", StringComparison.Ordinal)) return true;

            return cleaned.Equals("value", StringComparison.OrdinalIgnoreCase) ||
                   cleaned.Equals("file", StringComparison.OrdinalIgnoreCase) ||
                   cleaned.Equals("filename", StringComparison.OrdinalIgnoreCase) ||
                   cleaned.Equals("path", StringComparison.OrdinalIgnoreCase) ||
                   cleaned.Equals("dir", StringComparison.OrdinalIgnoreCase) ||
                   cleaned.Equals("directory", StringComparison.OrdinalIgnoreCase) ||
                   cleaned.Equals("port", StringComparison.OrdinalIgnoreCase) ||
                   cleaned.Equals("level", StringComparison.OrdinalIgnoreCase) ||
                   cleaned.Equals("format", StringComparison.OrdinalIgnoreCase) ||
                   cleaned.Equals("name", StringComparison.OrdinalIgnoreCase) ||
                   cleaned.Equals("string", StringComparison.OrdinalIgnoreCase);
        }

        private static string InferArgumentType(IEnumerable<string> flags)
        {
            foreach (var flag in flags)
            {
                if (flag.Contains("<", StringComparison.Ordinal) ||
                    flag.Contains("=", StringComparison.Ordinal) ||
                    flag.Contains("[", StringComparison.Ordinal))
                {
                    return "string";
                }
            }

            return "boolean";
        }

        private static IEnumerable<SchemaParameter> ParseParametersFromUsage(string commandName, IReadOnlyList<string> lines, IEnumerable<SchemaAction> actions)
        {
            var parameters = new List<SchemaParameter>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var actionNames = new HashSet<string>(actions.Select(action => action.Name), StringComparer.OrdinalIgnoreCase);
            var inUsageBlock = false;

            foreach (var raw in lines)
            {
                if (string.IsNullOrWhiteSpace(raw))
                {
                    inUsageBlock = false;
                    continue;
                }

                var trimmed = raw.TrimStart();
                if (trimmed.StartsWith("usage:", StringComparison.OrdinalIgnoreCase))
                {
                    inUsageBlock = true;
                    var usageText = trimmed.Substring("usage:".Length).Trim();
                    ExtractUsageTokens(commandName, usageText, parameters, seen, actionNames);
                    continue;
                }

                if (inUsageBlock && IsIndented(raw) && !SectionHeader.IsMatch(raw))
                {
                    ExtractUsageTokens(commandName, trimmed, parameters, seen, actionNames);
                    continue;
                }

                inUsageBlock = false;
            }

            return parameters;
        }

        private static void ExtractUsageTokens(string commandName, string usageText, ICollection<SchemaParameter> parameters, ISet<string> seen, ISet<string> actionNames)
        {
            var tokens = TokenizeUsage(usageText);
            foreach (var token in tokens)
            {
                var name = token.Text;
                if (string.IsNullOrWhiteSpace(name)) continue;
                if (name.StartsWith("-", StringComparison.Ordinal)) continue;
                if (string.Equals(name, "options", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(name, "option", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(name, "sdk-options", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(name, "command-options", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(commandName) &&
                    string.Equals(name, commandName, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (actionNames.Contains(name))
                {
                    continue;
                }

                if (seen.Contains(name)) continue;
                seen.Add(name);

                parameters.Add(new SchemaParameter
                {
                    Name = name,
                    Type = "string",
                    Required = !token.IsOptional
                });
            }
        }

        private static IEnumerable<UsageToken> TokenizeUsage(string usageText)
        {
            var tokens = new List<UsageToken>();
            if (string.IsNullOrWhiteSpace(usageText)) return tokens;

            var current = string.Empty;
            var bracketDepth = 0;
            var angleDepth = 0;

            void FlushToken(bool? optionalOverride = null)
            {
                if (string.IsNullOrWhiteSpace(current)) return;
                var raw = current;
                current = string.Empty;

                foreach (var part in raw.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                {
                    var cleaned = part.Trim().Trim('[', ']', '<', '>', '(', ')', ',', ';');
                    if (string.IsNullOrWhiteSpace(cleaned)) continue;
                    var isOptional = optionalOverride ?? (bracketDepth > 0);
                    tokens.Add(new UsageToken(cleaned, isOptional));
                }
            }

            foreach (var ch in usageText)
            {
                if (char.IsWhiteSpace(ch) && bracketDepth == 0 && angleDepth == 0)
                {
                    FlushToken();
                    continue;
                }

                if (ch == '[')
                {
                    bracketDepth++;
                    continue;
                }

                if (ch == ']')
                {
                    if (!string.IsNullOrWhiteSpace(current))
                    {
                        FlushToken(true);
                    }
                    bracketDepth = Math.Max(0, bracketDepth - 1);
                    continue;
                }

                if (ch == '<')
                {
                    angleDepth++;
                    current += ch;
                    continue;
                }

                if (ch == '>')
                {
                    current += ch;
                    angleDepth = Math.Max(0, angleDepth - 1);
                    continue;
                }

                current += ch;
            }

            FlushToken();
            return tokens;
        }

        private static bool IsIndented(string line)
        {
            return !string.IsNullOrEmpty(line) && char.IsWhiteSpace(line[0]);
        }

        private readonly record struct UsageToken(string Text, bool IsOptional);
    }
}
