package run

import (
	"testing"

	"github.com/stretchr/testify/require"
	taskcluster "github.com/taskcluster/taskcluster/v30/clients/client-go"
)

func makeState() State {
	return State{
		access: Access{
			RootURL: "https://tc.example.com",
			Credentials: taskcluster.Credentials{
				ClientID: "cli",
			},
		},
		identity: Identity{
			WorkerPoolID: "wp/id",
			WorkerGroup:  "wg",
			WorkerID:     "wid",
		},
		workerLocation: map[string]string{
			"cloud": "mushroom",
		},
	}
}

func TestCheckProviderResultsNoRootURL(t *testing.T) {
	state := makeState()
	state.access.RootURL = ""
	require.Error(t, state.CheckProviderResults())
}

func TestCheckProviderResultsRootURLwithSlash(t *testing.T) {
	state := makeState()
	state.access.RootURL = "https://tc.example.com/"
	require.Error(t, state.CheckProviderResults())
}

func TestCheckProviderResultsNoClientID(t *testing.T) {
	state := makeState()
	state.access.Credentials.ClientID = ""
	require.Error(t, state.CheckProviderResults())
}

func TestCheckProviderResultsNoWorkerPoolID(t *testing.T) {
	state := makeState()
	state.identity.WorkerPoolID = ""
	require.Error(t, state.CheckProviderResults())
}

func TestCheckProviderResultsNoWorkerGroup(t *testing.T) {
	state := makeState()
	state.identity.WorkerGroup = ""
	require.Error(t, state.CheckProviderResults())
}

func TestCheckProviderResultsNoWorkerID(t *testing.T) {
	state := makeState()
	state.identity.WorkerID = ""
	require.Error(t, state.CheckProviderResults())
}

func TestCheckProviderResultsNoCloud(t *testing.T) {
	state := makeState()
	delete(state.workerLocation, "cloud")
	require.Error(t, state.CheckProviderResults())
}
