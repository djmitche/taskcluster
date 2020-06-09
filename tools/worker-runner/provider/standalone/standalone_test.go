package standalone

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/cfg"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/run"
)

func TestConfigureRunNoOptional(t *testing.T) {
	runnerWorkerConfig := cfg.NewWorkerConfig()
	runnerWorkerConfig, err := runnerWorkerConfig.Set("from-runner-cfg", true)
	require.NoError(t, err, "setting config")
	runnercfg := &cfg.RunnerConfig{
		Provider: cfg.ProviderConfig{
			ProviderType: "standalone",
			Data: map[string]interface{}{
				"rootURL":      "https://tc.example.com",
				"clientID":     "testing",
				"accessToken":  "at",
				"workerPoolID": "w/p",
				"workerGroup":  "wg",
				"workerID":     "wi",
			},
		},
		WorkerImplementation: cfg.WorkerImplementationConfig{
			Implementation: "whatever",
		},
		WorkerConfig: runnerWorkerConfig,
	}

	p, err := New(runnercfg)
	require.NoError(t, err, "creating provider")

	state := run.State{}
	state.MergeWorkerConfig(runnercfg.WorkerConfig)
	err = p.ConfigureRun(&state)
	require.NoError(t, err)

	access := state.GetAccess()
	require.Equal(t, "https://tc.example.com", access.RootURL, "rootURL is correct")
	require.Equal(t, "testing", access.Credentials.ClientID, "clientID is correct")
	require.Equal(t, "at", access.Credentials.AccessToken, "accessToken is correct")
	require.Equal(t, "", access.Credentials.Certificate, "cert is correct")

	identity := state.GetIdentity()
	require.Equal(t, "w/p", identity.WorkerPoolID, "workerPoolID is correct")
	require.Equal(t, "wg", identity.WorkerGroup, "workerGroup is correct")
	require.Equal(t, "wi", identity.WorkerID, "workerID is correct")

	providerMetadata := state.GetProviderMetadata()
	require.Nil(t, providerMetadata, "providerMetadata is correct")

	require.Equal(t, true, state.GetWorkerConfig().MustGet("from-runner-cfg"), "value for from-runner-cfg")
	require.Equal(t, "standalone", state.GetWorkerLocation()["cloud"])
	require.Equal(t, 1, len(state.GetWorkerLocation()))
}

func TestConfigureRunAllOptional(t *testing.T) {
	runnerWorkerConfig := cfg.NewWorkerConfig()
	runnerWorkerConfig, err := runnerWorkerConfig.Set("from-runner-cfg", true)
	require.NoError(t, err, "setting config")
	runnercfg := &cfg.RunnerConfig{
		Provider: cfg.ProviderConfig{
			ProviderType: "standalone",
			Data: map[string]interface{}{
				"rootURL":      "https://tc.example.com",
				"clientID":     "testing",
				"accessToken":  "at",
				"workerPoolID": "w/p",
				"workerGroup":  "wg",
				"workerID":     "wi",
				"workerLocation": map[string]interface{}{
					"region": "underworld",
					"zone":   "666",
				},
				"providerMetadata": map[string]interface{}{
					"public-ip": "1.2.3.4",
					"secret-ip": "0.0.0.0",
				},
			},
		},
		WorkerImplementation: cfg.WorkerImplementationConfig{
			Implementation: "whatever",
		},
		WorkerConfig: runnerWorkerConfig,
	}

	p, err := New(runnercfg)
	require.NoError(t, err, "creating provider")

	state := run.State{}
	state.MergeWorkerConfig(runnercfg.WorkerConfig)
	err = p.ConfigureRun(&state)
	require.NoError(t, err)

	access := state.GetAccess()
	require.Equal(t, "https://tc.example.com", access.RootURL, "rootURL is correct")
	require.Equal(t, "testing", access.Credentials.ClientID, "clientID is correct")
	require.Equal(t, "at", access.Credentials.AccessToken, "accessToken is correct")
	require.Equal(t, "", access.Credentials.Certificate, "cert is correct")

	identity := state.GetIdentity()
	require.Equal(t, "w/p", identity.WorkerPoolID, "workerPoolID is correct")
	require.Equal(t, "wg", identity.WorkerGroup, "workerGroup is correct")
	require.Equal(t, "wi", identity.WorkerID, "workerID is correct")

	require.Equal(t, true, state.GetWorkerConfig().MustGet("from-runner-cfg"), "value for from-runner-cfg")
	require.Equal(t, "standalone", state.GetWorkerLocation()["cloud"])
	require.Equal(t, "underworld", state.GetWorkerLocation()["region"])
	require.Equal(t, "666", state.GetWorkerLocation()["zone"])

	providerMetadata := state.GetProviderMetadata()
	require.Equal(t, "1.2.3.4", providerMetadata["public-ip"])
	require.Equal(t, "0.0.0.0", providerMetadata["secret-ip"])
	require.Equal(t, 2, len(providerMetadata))
}

func TestConfigureRunNonStringLocation(t *testing.T) {
	runnerWorkerConfig := cfg.NewWorkerConfig()
	runnerWorkerConfig, err := runnerWorkerConfig.Set("from-runner-cfg", true)
	require.NoError(t, err, "setting config")
	runnercfg := &cfg.RunnerConfig{
		Provider: cfg.ProviderConfig{
			ProviderType: "standalone",
			Data: map[string]interface{}{
				"rootURL":      "https://tc.example.com",
				"clientID":     "testing",
				"accessToken":  "at",
				"workerPoolID": "w/p",
				"workerGroup":  "wg",
				"workerID":     "wi",
				"workerLocation": map[string]interface{}{
					"region": 13,
				},
			},
		},
		WorkerImplementation: cfg.WorkerImplementationConfig{
			Implementation: "whatever",
		},
		WorkerConfig: runnerWorkerConfig,
	}

	p, err := New(runnercfg)
	require.NoError(t, err, "creating provider")

	state := run.State{}
	state.MergeWorkerConfig(runnercfg.WorkerConfig)
	err = p.ConfigureRun(&state)
	if assert.Error(t, err) {
		require.Equal(t, fmt.Errorf("workerLocation value region is not a string"), err)
	}
}
