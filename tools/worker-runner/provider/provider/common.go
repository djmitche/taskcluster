package provider

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	taskcluster "github.com/taskcluster/taskcluster/v30/clients/client-go"
	"github.com/taskcluster/taskcluster/v30/clients/client-go/tcworkermanager"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/run"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/tc"
)

// WorkerInfo contains the information to identify the worker
type WorkerInfo struct {
	WorkerPoolID, WorkerGroup, WorkerID string
}

// Register this worker with the worker-manager, and update the state with the parameters and the results.
func RegisterWorker(state *run.State, wm tc.WorkerManager, workerPoolID, providerID, workerGroup, workerID string, workerIdentityProofMap map[string]interface{}) (*json.RawMessage, error) {
	workerIdentityProof, err := json.Marshal(workerIdentityProofMap)
	if err != nil {
		return nil, err
	}

	reg, err := wm.RegisterWorker(&tcworkermanager.RegisterWorkerRequest{
		WorkerPoolID:        workerPoolID,
		ProviderID:          providerID,
		WorkerGroup:         workerGroup,
		WorkerID:            workerID,
		WorkerIdentityProof: json.RawMessage(workerIdentityProof),
	})
	if err != nil {
		return nil, fmt.Errorf("Could not register worker: %v", err)
	}

	state.SetIdentity(run.Identity{
		WorkerPoolID: workerPoolID,
		WorkerID:     workerID,
		WorkerGroup:  workerGroup,
	})

	access := state.GetAccess()
	access.Credentials = taskcluster.Credentials{
		ClientID:    reg.Credentials.ClientID,
		AccessToken: reg.Credentials.AccessToken,
		Certificate: reg.Credentials.Certificate,
	}
	access.CredentialsExpire = time.Time(reg.Expires)
	state.SetAccess(access)

	wc := json.RawMessage(`{}`)
	if reg.WorkerConfig != nil {
		wc = reg.WorkerConfig
	}

	return &wc, nil
}

// RemoveWorker will request worker-manager to terminate the given worker, if it
// fails, it shuts down us
func RemoveWorker(state *run.State, factory tc.WorkerManagerClientFactory) error {
	shutdown := func() error {
		log.Printf("Falling back to system shutdown")
		if err := Shutdown(); err != nil {
			log.Printf("Error shutting down the worker: %v\n", err)
			return err
		}
		return nil
	}

	access := state.GetAccess()
	wc, err := factory(access.RootURL, &access.Credentials)
	if err != nil {
		log.Printf("Error instanciating worker-manager client: %v\n", err)
		return shutdown()
	}

	identity := state.GetIdentity()
	if err = wc.RemoveWorker(identity.WorkerPoolID, identity.WorkerGroup, identity.WorkerID); err != nil {
		log.Printf("Error removing the worker: %v\n", err)
		return shutdown()
	}

	return err
}
