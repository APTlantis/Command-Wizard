using System;
using System.IO;
using System.Linq;
using CommandWizard.Models;
using CommandWizard.Services;
using CommandWizard.ViewModels;
using Xunit;

namespace CommandWizard.Tests
{
    public class SchemaAndCommandTests
    {
        [Fact]
        public void ParseSchema_ValidToml_LoadsTool()
        {
            var toml = """
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
            """;

            var schema = SchemaSerialization.Parse(toml);

            Assert.Equal("rsync", schema.Name);
            Assert.Single(schema.Arguments);
            Assert.Single(schema.Parameters);
        }

        [Fact]
        public void ParseSchema_InvalidToml_Throws()
        {
            var toml = """
            [tool]
            name = "rsync"
            [[arguments
            """;

            Assert.Throws<InvalidOperationException>(() => SchemaSerialization.Parse(toml));
        }

        [Fact]
        public void BuildCommand_UsesCanonicalOrder()
        {
            var schema = new ToolSchema
            {
                Name = "git",
                InstalledName = "git-local"
            };
            schema.Actions.Add(new SchemaAction { Name = "clone" });
            schema.Arguments.Add(new SchemaArgument { Flag = "--depth", Type = "string" });
            schema.Arguments.Add(new SchemaArgument { Flag = "--quiet", Type = "boolean" });
            schema.Parameters.Add(new SchemaParameter { Name = "repo" });

            var toolVm = new ToolSchemaViewModel(schema);
            toolVm.Options[0].Value = "1";
            toolVm.Options[1].IsSelected = true;
            toolVm.Parameters[0].Value = "https://example.com/repo.git";

            var command = CommandBuilder.BuildCommand(toolVm, schema.Actions[0]);

            Assert.Equal("git-local clone --depth 1 --quiet https://example.com/repo.git", command);
        }

        [Fact]
        public void OptionToggle_UpdatesPreview()
        {
            var schema = new ToolSchema { Name = "rsync" };
            schema.Arguments.Add(new SchemaArgument { Long = "--archive", Type = "boolean" });

            var vm = new MainViewModel(new[] { schema });
            var option = vm.SelectedTool?.Options[0];
            Assert.NotNull(option);

            Assert.Equal("rsync", vm.CommandPreview);
            option!.IsSelected = true;

            Assert.Equal("rsync --archive", vm.CommandPreview);
        }

        [Fact]
        public void TagPresets_ExposeLargeDistinctPalette()
        {
            var vm = new MainViewModel(Array.Empty<ToolSchema>());

            Assert.True(vm.TagPresets.Count >= 100);
            Assert.Contains(vm.TagPresets, preset => preset.Name == "Blue 500");
            Assert.Equal(vm.TagPresets.Count, vm.TagPresets.Select(preset => preset.Color).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        }

        [Fact]
        public void HelpImport_Winget_ParsesActionsAndOptions()
        {
            var content = SampleHelpText;
            var helpText = ExtractHelpSection(content, "winget --help");
            var schema = HelpTextParser.Parse("winget", helpText);

            Assert.Contains(schema.Actions, action => action.Name == "install");
            Assert.Contains(schema.Actions, action => action.Name == "search");
            Assert.Contains(schema.Actions, action => action.Name == "list");
            Assert.Contains(schema.Arguments, arg => arg.Flag == "--verbose" || arg.Long == "--verbose");
            Assert.Contains(schema.Arguments, arg => arg.Flag == "--no-proxy" || arg.Long == "--no-proxy");
        }

        [Fact]
        public void HelpImport_Node_ParsesParametersAndOptions()
        {
            var content = SampleHelpText;
            var helpText = ExtractHelpSection(content, "node --help");
            var schema = HelpTextParser.Parse("node", helpText);

            Assert.Contains(schema.Parameters, param => string.Equals(param.Name, "script.js", StringComparison.OrdinalIgnoreCase));
            Assert.Contains(schema.Parameters, param => string.Equals(param.Name, "arguments", StringComparison.OrdinalIgnoreCase));
            Assert.True(schema.Arguments.Count > 50);
        }

        [Fact]
        public void HelpImport_Cloudflared_ParsesNestedCommands()
        {
            var content = SampleHelpText;
            var helpText = ExtractHelpSection(content, "cloudflared --help");
            var schema = HelpTextParser.Parse("cloudflared", helpText);

            Assert.Contains(schema.Actions, action => action.Name == "access");
            Assert.Contains(schema.Actions, action => action.Name == "tunnel");
        }

        [Fact]
        public void CompletionParser_PowerShell_ExtractsFlagsAndCommands()
        {
            var completion = """
            Register-ArgumentCompleter -CommandName foo -ScriptBlock {
                param($wordToComplete, $commandAst, $cursorPosition)
                $commands = @('init','deploy')
                $globalFlags = @('--help','--verbose','-v')
            }
            """;

            var parsed = CompletionScriptParser.Parse(completion);

            Assert.Contains(parsed.Actions, action => action.Name == "init");
            Assert.Contains(parsed.Actions, action => action.Name == "deploy");
            Assert.Contains(parsed.Arguments, arg => arg.Flag == "--help" || arg.Long == "--help");
            Assert.Contains(parsed.Arguments, arg => arg.Flag == "--verbose" || arg.Long == "--verbose");
            Assert.Contains(parsed.Arguments, arg => arg.Flag == "-v");
        }

        [Fact]
        public void CompletionParser_Bash_ExtractsFlags()
        {
            var completion = """
            _foo_completions() {
              local flags="--help --config -c --verbose"
              local commands="init deploy"
            }
            """;

            var parsed = CompletionScriptParser.Parse(completion);

            Assert.Contains(parsed.Arguments, arg => arg.Flag == "--help" || arg.Long == "--help");
            Assert.Contains(parsed.Arguments, arg => arg.Flag == "--config" || arg.Long == "--config");
            Assert.Contains(parsed.Arguments, arg => arg.Flag == "-c");
        }

        [Fact]
        public void CompletionMerge_AddsMissingFlags_WithoutOverwritingDescriptions()
        {
            var schema = new ToolSchema { Name = "demo" };
            schema.Arguments.Add(new SchemaArgument
            {
                Flag = "--help",
                Description = "Show help",
                Type = "boolean"
            });

            var completion = """
            Register-ArgumentCompleter -CommandName demo -ScriptBlock {
                $globalFlags = @('--help','--verbose')
            }
            """;

            HelpImportPipeline.ApplyCompletionText(schema, completion);

            var helpArg = schema.Arguments.First(arg => arg.Flag == "--help" || arg.Long == "--help");
            Assert.Equal("Show help", helpArg.Description);
            Assert.Contains(schema.Arguments, arg => arg.Flag == "--verbose" || arg.Long == "--verbose");
        }

        [Fact]
        public void CompletionParser_PairsShortAndLongFlags()
        {
            var completion = """
            Register-ArgumentCompleter -CommandName demo -ScriptBlock {
                $flags = @("-v, --verbose", "--config -c")
            }
            """;

            var parsed = CompletionScriptParser.Parse(completion);

            var verbose = parsed.Arguments.First(arg => arg.Flag == "-v" || arg.Long == "--verbose");
            Assert.Equal("--verbose", string.IsNullOrWhiteSpace(verbose.Long) ? verbose.Flag : verbose.Long);
            Assert.Equal("-v", verbose.Flag);

            var config = parsed.Arguments.First(arg => arg.Flag == "-c" || arg.Long == "--config");
            Assert.Equal("--config", string.IsNullOrWhiteSpace(config.Long) ? config.Flag : config.Long);
            Assert.Equal("-c", config.Flag);
        }

        [Fact]
        public void CompletionParser_IgnoresPlainRuntimeErrorText()
        {
            var completion = """
            Error: Cannot find module 'B:\zypper-operations\CommandWizard\bin\Debug\net10.0-windows10.0.26100\completion'
            You did not specify any valid additional argument to the cloudflared command.
            """;

            var parsed = CompletionScriptParser.Parse(completion);

            Assert.Empty(parsed.Actions);
            Assert.Empty(parsed.Arguments);
        }

        [Fact]
        public void HelpImport_CloudflaredValueOptions_AreStringArguments()
        {
            var helpText = """
            cloudflared - Cloudflare's command-line tool and agent

            USAGE:
              cloudflared [global options] [command] [command options]

            COMMANDS:
              update   Update the agent if a new version exists
              tunnel   Use Cloudflare Tunnel

            GLOBAL OPTIONS:
              --output value                  Output format for the logs
              --proxy-dns                     (default: false)
              --proxy-dns-port value          (default: 0)
              --credentials-file value, --cred-file value  Filepath at which to read/write credentials
              --help, -h                      show help
            """;

            var schema = HelpTextParser.Parse("cloudflared", helpText);

            Assert.Contains(schema.Actions, action => action.Name == "update");
            Assert.Contains(schema.Actions, action => action.Name == "tunnel");
            Assert.Contains(schema.Arguments, arg => arg.Flag == "--output" && arg.Type == "string" && arg.Description.StartsWith("Output format"));
            Assert.Contains(schema.Arguments, arg => arg.Flag == "--proxy-dns" && arg.Type == "boolean");
            Assert.Contains(schema.Arguments, arg => arg.Flag == "--proxy-dns-port" && arg.Type == "string");
        }

        [Fact]
        public void HelpImport_NodeMultilineOptions_DoesNotCollapseIntoDashArgument()
        {
            var helpText = """
            Usage: node [options] [ script.js ] [arguments]

            Options:
              -
                            script read from stdin (default if no
                            file name is provided)
              --
                            indicate the end of node options
              --abort-on-uncaught-exception
                            aborting instead of exiting causes a
                            core file to be generated
              -c, --check
                            syntax check script without executing
            """;

            var schema = HelpTextParser.Parse("node", helpText);

            Assert.Contains(schema.Arguments, arg => arg.Flag == "--abort-on-uncaught-exception" && arg.Description.Contains("aborting"));
            Assert.Contains(schema.Arguments, arg => arg.Flag == "-c" && arg.Long == "--check");
            var dash = schema.Arguments.First(arg => arg.Flag == "-");
            Assert.DoesNotContain("--abort-on-uncaught-exception", dash.Description);
        }

        [Fact]
        public void HelpImport_MongoSlashOptions_ParseAsArgumentsNotActions()
        {
            var helpText = """
            Usage:
              mongoimport <options> <connection-string> <file>

            general options:
              /help                                      print usage
              /version                                   print the tool version and exit
              /config:<filename>                         path to a configuration file

            connection options:
              /h, /host:<hostname>                       mongodb host to connect to
              /port:<port>                               server port
            """;

            var draft = HelpImportPipeline.CreateDraft("mongoimport", helpText, useAdvancedSources: true);

            Assert.Empty(draft.StagedActions);
            Assert.Contains(draft.StagedArguments, arg => arg.Flag == "/help");
            Assert.Contains(draft.StagedArguments, arg => arg.Flag == "/config:<filename>" && arg.Type == "string");
            Assert.Contains(draft.StagedArguments, arg => arg.Flag == "/h" && arg.Type == "string");
            Assert.Contains(draft.StagedParameters, param => param.Name == "connection-string");
            Assert.Contains(draft.StagedParameters, param => param.Name == "file");
        }

        [Fact]
        public void HelpImport_DotnetSdkCommandsAndPipeOptions_Parse()
        {
            var helpText = """
            Execute a .NET SDK command.

            Usage: dotnet [sdk-options] [command] [command-options] [arguments]

            sdk-options:
              -d|--diagnostics  Enable diagnostic output.
              -h|--help         Show command line help.
              --info            Display .NET information.

            SDK commands:
              build           Build a .NET project.
              build-server    Interact with servers started by a build.
              clean           Clean build outputs of a .NET project.
              format          Apply style preferences to a project or solution.
            """;

            var schema = HelpTextParser.Parse("dotnet", helpText);

            Assert.Contains(schema.Actions, action => action.Name == "build" && action.Description.StartsWith("Build"));
            Assert.Contains(schema.Actions, action => action.Name == "build-server");
            Assert.Contains(schema.Arguments, arg => arg.Flag == "-d" && arg.Long == "--diagnostics");
            Assert.Contains(schema.Arguments, arg => arg.Flag == "-h" && arg.Long == "--help");
            Assert.DoesNotContain(schema.Parameters, param => param.Name == "sdk-options");
            Assert.DoesNotContain(schema.Parameters, param => param.Name == "command-options");
        }

        [Fact]
        public void HelpImport_OpensslMultiColumnStandardCommands_Parse()
        {
            var helpText = """
            help:

            Standard commands
            asn1parse         ca                 ciphers            cmp
            cms               configutl          crl                crl2pkcs7
            dgst              dhparam            dsa                dsaparam

            Message Digest commands (see the `dgst` command for more details)
            blake2b512        blake2s256         md4                md5
            sha1              sha224             sha256             sha384
            """;

            var schema = HelpTextParser.Parse("openssl", helpText);

            Assert.Contains(schema.Actions, action => action.Name == "asn1parse");
            Assert.Contains(schema.Actions, action => action.Name == "ciphers");
            Assert.Contains(schema.Actions, action => action.Name == "crl2pkcs7");
            Assert.Contains(schema.Actions, action => action.Name == "sha256");
        }

        [Fact]
        public void HelpImport_WinappMojibakeTable_NormalizesActionRows()
        {
            var helpText = """
            CLI for Windows app development, including package identity, packaging,
            projections, and more.

            Usage: winapp <command> [options]

            Use 'winapp <command> --help' to get detailed help for any command.

            â”Œâ”€Setupâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
            â”,  init     Initialize existing project with manifest and/or SDK packages â”‚
            â”,  restore  Restore packages and projections from winapp.yaml        â”‚
            â”,  update   Update packages in winapp.yaml                           â”‚
            â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
            â”Œâ”€Packaging & Signingâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
            â”,  package                  Create MSIX package                      â”‚
            â”,  create-external-catalog  Generate CodeIntegrityExternal.cat for   â”‚
            â”,                           TrustedLaunch sparse packages            â”‚
            â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
            """;

            var schema = HelpTextParser.Parse("winapp", helpText);

            Assert.Contains(schema.Actions, action => action.Name == "init" && action.Description.StartsWith("Initialize"));
            Assert.Contains(schema.Actions, action => action.Name == "restore");
            Assert.Contains(schema.Actions, action => action.Name == "update");
            Assert.Contains(schema.Actions, action => action.Name == "package");
            Assert.Contains(schema.Actions, action => action.Name == "create-external-catalog");
            Assert.DoesNotContain(schema.Actions, action => action.Name == "Setup");
            Assert.DoesNotContain(schema.Actions, action => action.Name == "Packaging");
            Assert.DoesNotContain(schema.Actions, action => action.Name == "TrustedLaunch");
        }

        [Fact]
        public void HelpImport_GitCategoryHeadings_AreNotActions()
        {
            var helpText = """
            usage: git [--version] [--help] <command> [<args>]

            These are common Git commands used in various situations:

            start a working area (see also: git help tutorial)
               clone     Clone a repository into a new directory
               init      Create an empty Git repository or reinitialize an existing one

            grow, mark and tweak your common history
               branch    List, create, or delete branches
               commit    Record changes to the repository
            """;

            var schema = HelpTextParser.Parse("git", helpText);

            Assert.Contains(schema.Actions, action => action.Name == "clone");
            Assert.Contains(schema.Actions, action => action.Name == "init");
            Assert.Contains(schema.Actions, action => action.Name == "branch");
            Assert.Contains(schema.Actions, action => action.Name == "commit");
            Assert.DoesNotContain(schema.Actions, action => action.Name == "start");
            Assert.DoesNotContain(schema.Actions, action => action.Name == "grow");
        }

        [Fact]
        public void HelpImportDraft_UsefulSingleBucketDrafts_DoNotWarn()
        {
            var actionOnlyHelp = """
            help:

            Standard commands
            asn1parse         ca                 ciphers            cmp
            cms               configutl          crl                crl2pkcs7
            """;

            var argumentOnlyHelp = """
            Usage: ffmpeg [options] input output

            Options:
              -h          show help
              -i <file>   input file
              --version   show version
            """;

            var actionDraft = HelpImportPipeline.CreateDraft("openssl", actionOnlyHelp, useAdvancedSources: false);
            var argumentDraft = HelpImportPipeline.CreateDraft("ffmpeg", argumentOnlyHelp, useAdvancedSources: false);

            Assert.NotEmpty(actionDraft.StagedActions);
            Assert.Empty(actionDraft.ParseWarnings);
            Assert.NotEmpty(argumentDraft.StagedArguments);
            Assert.Empty(argumentDraft.ParseWarnings);
        }

        [Fact]
        public void HelpImportDraft_Winget_PrefillsBuckets()
        {
            var helpText = ExtractHelpSection(SampleHelpText, "winget --help");
            var draft = HelpImportPipeline.CreateDraft("winget", helpText, useAdvancedSources: false);

            Assert.Equal("winget", draft.ToolName);
            Assert.Contains(draft.StagedActions, action => action.Name == "install");
            Assert.Contains(draft.StagedArguments, arg => arg.Flag == "--verbose" || arg.Long == "--verbose");
            Assert.Contains(draft.StagedParameters, param => param.Name == "command");
        }

        [Fact]
        public void HelpImportDraft_GraphvizStyleCompactFlags_PrefillsArguments()
        {
            var helpText = """
            Usage: C:\Program Files\Graphviz\bin\dot [-Vv?] [-(GNE)name=val] [-K(Tls)<val>] <dot files>
            -v          - Print version and exit
            -Tv         - Set output format to 'v'
            -Kv         - Set layout engine to 'v'
            -ofile      - Write output to 'file'
            -?          - Print usage and exit
            """;

            var draft = HelpImportPipeline.CreateDraft("dot", helpText, useAdvancedSources: false);

            Assert.Contains(draft.StagedArguments, arg => arg.Flag == "-v");
            Assert.Contains(draft.StagedArguments, arg => arg.Flag == "-Tv");
            Assert.Contains(draft.StagedArguments, arg => arg.Flag == "-ofile");
            Assert.Contains(draft.StagedParameters, param => param.Name == "dot files");
        }

        [Fact]
        public void HelpImportDraft_NodeLargeOptionList_PrefillsManyArgumentsAndParameters()
        {
            var helpText = ExtractHelpSection(SampleHelpText, "node --help");
            var draft = HelpImportPipeline.CreateDraft("node", helpText, useAdvancedSources: false);

            Assert.True(draft.StagedArguments.Count > 50);
            Assert.Contains(draft.StagedParameters, param => param.Name == "script.js");
            Assert.Contains(draft.StagedParameters, param => param.Name == "arguments");
        }

        [Fact]
        public void HelpImportDraft_PasteLines_AddsRowsWithDescriptions()
        {
            var draft = new HelpImportDraft();

            HelpImportPipeline.AddActionLines(draft, """
            render     Render a project
            inspect    Inspect media metadata
            """);

            HelpImportPipeline.AddArgumentLines(draft, """
            -i, --input <file>  Input file
            --overwrite         Replace existing output
            """);

            HelpImportPipeline.AddParameterLines(draft, """
            <source>
            [destination]
            """);

            Assert.Contains(draft.StagedActions, action => action.Name == "render" && action.Description == "Render a project");
            Assert.Contains(draft.StagedArguments, arg => arg.Flag == "-i" && arg.Long == "--input" && arg.Description == "Input file");
            Assert.Contains(draft.StagedArguments, arg => arg.Flag == "--overwrite" && arg.Type == "boolean");
            Assert.Contains(draft.StagedParameters, param => param.Name == "source" && param.Required);
            Assert.Contains(draft.StagedParameters, param => param.Name == "destination" && !param.Required);
        }

        [Fact]
        public void HelpImportDraft_BuildSchema_UsesEditedStagedRowsExactly()
        {
            var draft = new HelpImportDraft
            {
                ToolName = "ffmpeg",
                Description = "edited description",
                InstalledName = "ffmpeg.exe",
                ExecutablePath = @"C:\tools\ffmpeg.exe"
            };
            draft.StagedActions.Add(new SchemaAction { Name = "convert", Description = "Convert media" });
            draft.StagedArguments.Add(new SchemaArgument
            {
                Flag = "-i",
                Long = "--input",
                Description = "Edited input description",
                Type = "path",
                ValueStyle = ArgumentValueStyle.SpaceSeparated
            });
            draft.StagedParameters.Add(new SchemaParameter { Name = "output", Type = "path", Required = true });

            var schema = HelpImportPipeline.BuildSchemaFromDraft(draft);

            Assert.Equal("ffmpeg", schema.Name);
            Assert.Equal("edited description", schema.Description);
            Assert.Single(schema.Actions);
            Assert.Equal("convert", schema.Actions[0].Name);
            Assert.Single(schema.Arguments);
            Assert.Equal("-i", schema.Arguments[0].Flag);
            Assert.Equal("--input", schema.Arguments[0].Long);
            Assert.Equal("Edited input description", schema.Arguments[0].Description);
            Assert.Single(schema.Parameters);
            Assert.Equal("output", schema.Parameters[0].Name);
        }

        private static string ExtractHelpSection(string content, string commandLine)
        {
            var lines = content.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
            var startIndex = -1;
            for (var i = 0; i < lines.Length; i++)
            {
                var line = lines[i];
                if (line.StartsWith("PS ", StringComparison.OrdinalIgnoreCase) &&
                    line.Contains($"> {commandLine}", StringComparison.OrdinalIgnoreCase))
                {
                    startIndex = i + 1;
                    break;
                }
            }

            if (startIndex < 0)
            {
                throw new InvalidOperationException($"Command line '{commandLine}' not found.");
            }

            var collected = lines
                .Skip(startIndex)
                .TakeWhile(line => !line.StartsWith("PS ", StringComparison.OrdinalIgnoreCase))
                .ToArray();

            return string.Join(Environment.NewLine, collected).Trim();
        }

        private const string SampleHelpText = """
        PS B:\zypper-operations\CommandWizard> winget --help
        Windows Package Manager

        Usage: winget [<command>] [<options>]

        Commands:
          install      Installs the given package
          search       Searches for a package
          list         Lists installed packages

        Options:
          --verbose    Enables verbose logging
          --no-proxy   Disables proxy use
          -?, --help   Shows help
        PS B:\zypper-operations\CommandWizard> node --help
        Node.js JavaScript runtime

        Usage: node [options] [script.js] [arguments]

        Options:
          --abort-on-uncaught-exception  Aborting instead of exiting
          --allow-addons                 Allow addons
          --allow-child-process          Allow child process
          --allow-fs-read=<path>         Allow file system read
          --allow-fs-write=<path>        Allow file system write
          --allow-wasi                  Allow WASI
          --build-snapshot              Generate a snapshot blob
          --completion-bash             Print source-able bash completion
          --conditions=<conditions>     Additional user conditions
          --cpu-prof                    Start the V8 CPU profiler
          --cpu-prof-dir=<directory>    Directory for CPU profiles
          --cpu-prof-interval=<interval> Sampling interval
          --cpu-prof-name=<file>        CPU profile file name
          --diagnostic-dir=<directory>  Diagnostic artifact directory
          --disable-proto=<mode>        Disable Object.prototype.__proto__
          --disable-warning=<code>      Silence warning code
          --disable-wasm-trap-handler   Disable trap handler
          --dns-result-order=<order>    Set DNS result order
          --enable-fips                 Enable FIPS crypto
          --enable-network-family-autoselection Enable auto selection
          --enable-source-maps          Enable source maps
          --entry-url                   Treat entrypoint as URL
          --env-file=<file>             Load environment variables
          --experimental-default-type=<type> Set default module type
          --experimental-detect-module  Detect module syntax
          --experimental-eventsource    Enable EventSource
          --experimental-import-meta-resolve Enable import.meta.resolve
          --experimental-loader=<loader> Use custom loader
          --experimental-network-imports Enable network imports
          --experimental-permission     Enable permission model
          --experimental-print-required-tla Print top-level await info
          --experimental-require-module Enable require module
          --experimental-sea-config=<file> Use SEA config
          --experimental-test-coverage  Enable test coverage
          --experimental-vm-modules     Enable vm modules
          --experimental-wasi-unstable-preview1 Enable WASI preview
          --experimental-wasm-modules   Enable wasm modules
          --force-context-aware         Require context-aware addons
          --force-fips                  Force FIPS crypto
          --force-node-api-uncaught-exceptions-policy Force policy
          --frozen-intrinsics           Freeze intrinsics
          --heap-prof                   Start heap profiler
          --heap-prof-dir=<directory>   Heap profile directory
          --heap-prof-interval=<bytes>  Heap allocation interval
          --heap-prof-name=<file>       Heap profile name
          --heapsnapshot-near-heap-limit=<count> Snapshot near heap limit
          --heapsnapshot-signal=<signal> Generate heap snapshot on signal
          --http-parser=<type>          Select HTTP parser
          --icu-data-dir=<directory>    ICU data directory
          --import=<module>             Preload ES module
          --input-type=<type>           Set input type
          --inspect                     Activate inspector
          --inspect-brk                 Activate inspector and break
          --inspect-port=<port>         Set inspector port
          --jitless                     Disable runtime allocation of executable memory
          --max-http-header-size=<size> Set max header size
          --no-addons                   Disable addons
          --no-deprecation              Silence deprecation warnings
          --no-experimental-fetch       Disable fetch
          --no-experimental-global-customevent Disable CustomEvent
          --no-experimental-repl-await  Disable REPL await
          --no-extra-info-on-fatal-exception Hide extra fatal info
          --no-force-async-hooks-checks Disable async hooks checks
          --no-global-search-paths      Disable global module paths
          --no-network-family-autoselection Disable network family autoselection
          --no-warnings                 Silence process warnings
          --node-memory-debug           Enable memory debug
          --openssl-config=<file>       Load OpenSSL config
          --pending-deprecation         Emit pending deprecations
          --preserve-symlinks           Preserve symlinks
          --preserve-symlinks-main      Preserve main symlink
          --prof                        Generate V8 profiler output
          --prof-process                Process V8 profiler output
          --redirect-warnings=<file>    Write warnings to file
          --report-compact              Write compact report
          --report-directory=<directory> Report directory
          --report-filename=<file>      Report file name
          --report-on-fatalerror        Report on fatal error
          --report-on-signal            Report on signal
          --report-signal=<signal>      Report signal
          --report-uncaught-exception   Report uncaught exception
          --secure-heap=<size>          Use secure heap
          --secure-heap-min=<size>      Use secure heap min
          --snapshot-blob=<file>        Snapshot blob path
          --test                        Run test runner
          --test-concurrency=<n>        Test concurrency
          --test-name-pattern=<pattern> Test name pattern
          --test-only                   Run only marked tests
          --test-reporter=<reporter>    Test reporter
          --test-reporter-destination=<dest> Reporter destination
          --test-shard=<shard>          Test shard
          --throw-deprecation           Throw deprecations
          --title=<title>               Set process title
          --tls-cipher-list=<list>      TLS cipher list
          --tls-keylog=<file>           TLS key log
          --tls-max-v1.2                Set TLS max v1.2
          --tls-max-v1.3                Set TLS max v1.3
          --tls-min-v1.0                Set TLS min v1.0
          --tls-min-v1.1                Set TLS min v1.1
          --tls-min-v1.2                Set TLS min v1.2
          --tls-min-v1.3                Set TLS min v1.3
          --trace-atomics-wait          Trace atomics wait
          --trace-deprecation           Trace deprecations
          --trace-event-categories=<cats> Trace categories
          --trace-event-file-pattern=<pattern> Trace file pattern
          --trace-exit                  Trace exit
          --trace-sigint                Trace SIGINT
          --trace-sync-io               Trace sync IO
          --trace-tls                   Trace TLS
          --trace-uncaught              Trace uncaught exceptions
          --trace-warnings              Trace warnings
          --track-heap-objects          Track heap objects
          --unhandled-rejections=<mode> Set unhandled rejection behavior
          --use-bundled-ca              Use bundled CA
          --use-largepages=<mode>       Use large pages
          --use-openssl-ca              Use OpenSSL CA
          --v8-options                  Print V8 options
          --watch                       Watch mode
          --watch-path=<path>           Watch path
          --watch-preserve-output       Preserve watch output
          --zero-fill-buffers           Zero fill buffers
        PS B:\zypper-operations\CommandWizard> cloudflared --help
        Cloudflare Tunnel client

        Usage: cloudflared [command] [options]

        Commands:
          access       access-related commands
          tunnel       tunnel-related commands

        Options:
          --config <path> Path to config file
          --help          Show help
        """;
    }
}
