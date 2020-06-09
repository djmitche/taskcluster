package static

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/cfg"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/run"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/tc"
)

func TestConfigureRun(t *testing.T) {
	runnerWorkerConfig := cfg.NewWorkerConfig()
	runnerWorkerConfig, err := runnerWorkerConfig.Set("from-runner-cfg", true)
	require.NoError(t, err, "setting config")
	runnercfg := &cfg.RunnerConfig{
		Provider: cfg.ProviderConfig{
			ProviderType: "static",
			Data: map[string]interface{}{
				"rootURL":      "https://tc.example.com",
				"providerID":   "static-1",
				"workerPoolID": "w/p",
				"workerGroup":  "wg",
				"workerID":     "wi",
				"staticSecret": "quiet",
				"workerLocation": map[string]interface{}{
					"region": "underworld",
					"zone":   "666",
				},
				"providerMetadata": map[string]interface{}{
					"temperature": "24",
				},
			},
		},
		WorkerImplementation: cfg.WorkerImplementationConfig{
			Implementation: "whatever",
		},
		WorkerConfig: runnerWorkerConfig,
	}

	p, err := new(runnercfg, tc.FakeWorkerManagerClientFactory)
	require.NoError(t, err, "creating provider")

	state := run.State{}
	state.MergeWorkerConfig(runnercfg.WorkerConfig)
	err = p.ConfigureRun(&state)
	require.NoError(t, err)

	reg, err := tc.FakeWorkerManagerRegistration()
	require.NoError(t, err)
	require.Equal(t, "static-1", reg.ProviderID)
	require.Equal(t, "wg", reg.WorkerGroup)
	require.Equal(t, "wi", reg.WorkerID)
	require.Equal(t, json.RawMessage(`{"staticSecret":"quiet"}`), reg.WorkerIdentityProof)
	require.Equal(t, "w/p", reg.WorkerPoolID)

	access := state.GetAccess()
	require.Equal(t, "https://tc.example.com", access.RootURL, "rootURL is correct")
	require.Equal(t, "testing", access.Credentials.ClientID, "clientID is correct")
	require.Equal(t, "at", access.Credentials.AccessToken, "accessToken is correct")
	require.Equal(t, "cert", access.Credentials.Certificate, "cert is correct")

	identity := state.GetIdentity()
	require.Equal(t, "w/p", identity.WorkerPoolID, "workerPoolID is correct")
	require.Equal(t, "wg", identity.WorkerGroup, "workerGroup is correct")
	require.Equal(t, "wi", identity.WorkerID, "workerID is correct")

	providerMetadata := state.GetProviderMetadata()
	require.Equal(t, map[string]interface{}{"temperature": "24"}, providerMetadata, "providerMetadata is correct")

	require.Equal(t, true, state.GetWorkerConfig().MustGet("from-runner-cfg"), "value for from-runner-cfg")

	workerLocation := state.GetWorkerLocation()
	require.Equal(t, "static", workerLocation["cloud"])
	require.Equal(t, "underworld", workerLocation["region"])
	require.Equal(t, "666", workerLocation["zone"])
}
