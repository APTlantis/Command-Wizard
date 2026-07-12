using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using CommandWizard.Models;

namespace CommandWizard.Services
{
    public sealed class CompletionParseResult
    {
        public List<SchemaArgument> Arguments { get; } = new();
        public List<SchemaAction> Actions { get; } = new();
    }

    public static class CompletionScriptParser
    {
        private static readonly Regex LongFlagRegex = new(@"(?<!\w)--[A-Za-z0-9][A-Za-z0-9_-]*", RegexOptions.Compiled);
        private static readonly Regex ShortFlagRegex = new(@"(?<!-)-[A-Za-z0-9](?![A-Za-z0-9_-])", RegexOptions.Compiled);
        private static readonly Regex QuotedTokenRegex = new(@"['""](?<token>[A-Za-z0-9][A-Za-z0-9_-]*)['""]", RegexOptions.Compiled);
        private static readonly Regex CommandAssignmentRegex = new(@"\b(?:commands|subcommands)\b\s*=\s*['""]?(?<tokens>[A-Za-z0-9_\-\s]+)['""]?", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex ShortLongPairRegex = new(@"(?<short>-[A-Za-z0-9])\s*,?\s*(?<long>--[A-Za-z0-9][A-Za-z0-9_-]*)", RegexOptions.Compiled);
        private static readonly Regex LongShortPairRegex = new(@"(?<long>--[A-Za-z0-9][A-Za-z0-9_-]*)\s*,?\s*(?<short>-[A-Za-z0-9])", RegexOptions.Compiled);

        public static CompletionParseResult Parse(string completionText)
        {
            var result = new CompletionParseResult();
            if (string.IsNullOrWhiteSpace(completionText))
            {
                return result;
            }

            var seenArgs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var seenActions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var lines = completionText.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);

            foreach (var raw in lines)
            {
                var line = raw.Trim();
                if (string.IsNullOrWhiteSpace(line)) continue;

                var longFlags = LongFlagRegex.Matches(line).Select(m => m.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                var shortFlags = ShortFlagRegex.Matches(line).Select(m => m.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

                if (longFlags.Count > 0 || shortFlags.Count > 0)
                {
                    var usedShort = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    var usedLong = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                    foreach (var (shortFlag, longFlag) in ExtractPairs(line))
                    {
                        AddArgumentPair(result, seenArgs, shortFlag, longFlag);
                        if (!string.IsNullOrWhiteSpace(shortFlag)) usedShort.Add(shortFlag);
                        if (!string.IsNullOrWhiteSpace(longFlag)) usedLong.Add(longFlag);
                    }

                    foreach (var longFlag in longFlags.Where(flag => !usedLong.Contains(flag)))
                    {
                        var argument = new SchemaArgument
                        {
                            Flag = longFlag,
                            Long = "",
                            Description = "",
                            Type = "boolean"
                        };

                        var key = HelpImportPipeline.GetArgumentKey(argument);
                        if (seenArgs.Add(key))
                        {
                            result.Arguments.Add(argument);
                        }
                    }

                    foreach (var shortFlag in shortFlags.Where(flag => !usedShort.Contains(flag)))
                    {
                        var argument = new SchemaArgument
                        {
                            Flag = shortFlag,
                            Long = "",
                            Description = "",
                            Type = "boolean"
                        };
                        var key = HelpImportPipeline.GetArgumentKey(argument);
                        if (seenArgs.Add(key))
                        {
                            result.Arguments.Add(argument);
                        }
                    }
                }

                foreach (var action in ExtractActions(line))
                {
                    if (seenActions.Add(action))
                    {
                        result.Actions.Add(new SchemaAction
                        {
                            Name = action,
                            Description = ""
                        });
                    }
                }
            }

            return result;
        }

        private static IEnumerable<string> ExtractActions(string line)
        {
            if (!line.Contains("command", StringComparison.OrdinalIgnoreCase) &&
                !line.Contains("subcommand", StringComparison.OrdinalIgnoreCase))
            {
                return Array.Empty<string>();
            }

            if (LooksLikeRuntimeError(line))
            {
                return Array.Empty<string>();
            }

            var lower = line.ToLowerInvariant();
            var actionishLine = lower.Contains("$commands") ||
                                lower.Contains(" commands=") ||
                                lower.Contains("commands =") ||
                                lower.Contains("local commands") ||
                                lower.Contains("$subcommands") ||
                                lower.Contains("subcommands =");

            if (!actionishLine)
            {
                return Array.Empty<string>();
            }

            var quoted = QuotedTokenRegex.Matches(line).Select(m => m.Groups["token"].Value).ToList();
            if (quoted.Count > 0)
            {
                return quoted;
            }

            var assignment = CommandAssignmentRegex.Match(line);
            if (assignment.Success)
            {
                return assignment.Groups["tokens"].Value
                    .Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            }

            return Array.Empty<string>();
        }

        private static bool LooksLikeRuntimeError(string line)
        {
            return line.Contains("error", StringComparison.OrdinalIgnoreCase) ||
                   line.Contains("cannot find", StringComparison.OrdinalIgnoreCase) ||
                   line.Contains("did not specify", StringComparison.OrdinalIgnoreCase) ||
                   line.Contains("stack trace", StringComparison.OrdinalIgnoreCase);
        }

        private static IEnumerable<(string ShortFlag, string LongFlag)> ExtractPairs(string line)
        {
            var pairs = new List<(string, string)>();
            foreach (Match match in ShortLongPairRegex.Matches(line))
            {
                var shortFlag = match.Groups["short"].Value;
                var longFlag = match.Groups["long"].Value;
                if (!string.IsNullOrWhiteSpace(shortFlag) && !string.IsNullOrWhiteSpace(longFlag))
                {
                    pairs.Add((shortFlag, longFlag));
                }
            }

            foreach (Match match in LongShortPairRegex.Matches(line))
            {
                var longFlag = match.Groups["long"].Value;
                var shortFlag = match.Groups["short"].Value;
                if (!string.IsNullOrWhiteSpace(shortFlag) && !string.IsNullOrWhiteSpace(longFlag))
                {
                    pairs.Add((shortFlag, longFlag));
                }
            }

            return pairs;
        }

        private static void AddArgumentPair(CompletionParseResult result, HashSet<string> seenArgs, string shortFlag, string longFlag)
        {
            var argument = new SchemaArgument
            {
                Flag = string.IsNullOrWhiteSpace(shortFlag) ? longFlag : shortFlag,
                Long = string.IsNullOrWhiteSpace(shortFlag) ? "" : longFlag,
                Description = "",
                Type = "boolean"
            };

            var key = HelpImportPipeline.GetArgumentKey(argument);
            if (seenArgs.Add(key))
            {
                result.Arguments.Add(argument);
            }
        }
    }
}
