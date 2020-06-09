package run

import (
	"fmt"
	"strings"
	"sync"
	"time"

	taskcluster "github.com/taskcluster/taskcluster/v30/clients/client-go"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/cfg"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/files"
)

// Data used to access taskcluster services
type Access struct {
	// Information about the Taskcluster deployment where this
	// worker is running
	RootURL string

	// Credentials for the worker, and their expiration time.  Shortly before
	// this expiration, worker-runner will try to gracefully stop the worker
	Credentials       taskcluster.Credentials
	CredentialsExpire time.Time `yaml:",omitempty"`
}

// Data about this worker's identity
type Identity struct {
	// Information about this worker
	WorkerPoolID string
	WorkerGroup  string
	WorkerID     string
}

// State represents the state of the worker run.  Its contents are built up
// bit-by-bit during the start-worker process.  Its contents are all private,
// and can only be read or changed via access methods, to ensure proper
// locking.  This structure is thus safe for concurrent use from mulitple
// Goroutines.
type State struct {
	access   Access
	identity Identity

	// metadata from the provider (useful to display to the user for
	// debugging).
	//
	// Docker-worker currently expects the following properties:
	//
	//  * public-hostname
	//  * public-ipv4
	//  * local-ipv4
	//  * instance-type
	//  * instance-id
	//  * region
	//
	// It doesn't, strictly speaking, require these fields,
	// but may fall onto undesirable defaults if these are not provided
	// A bit more info on that here
	// https://github.com/taskcluster/taskcluster-worker-runner/pull/30#pullrequestreview-277378260
	providerMetadata map[string]interface{}

	// the accumulated WorkerConfig for this run, including files to create
	workerConfig *cfg.WorkerConfig
	files        []files.File

	// The worker location configuration
	workerLocation map[string]string

	// a Mutex covering all of the data in this struct
	l sync.RWMutex
}

// Get a copy of the current Access state
func (state *State) GetAccess() Access {
	state.l.RLock()
	rv := state.access
	state.l.RUnlock()
	return rv
}

// Update the current Access state, overwriting all fields
func (state *State) SetAccess(access Access) {
	state.l.Lock()
	state.access = access
	state.l.Unlock()
}

// Get a copy of the current Identity state
func (state *State) GetIdentity() Identity {
	state.l.RLock()
	rv := state.identity
	state.l.RUnlock()
	return rv
}

// Set the current Identity state
func (state *State) SetIdentity(identity Identity) {
	state.l.Lock()
	state.identity = identity
	state.l.Unlock()
}

// Get a read-only (pinky swear!) copy of the current provider metadata
func (state *State) GetProviderMetadata() map[string]interface{} {
	state.l.RLock()
	rv := state.providerMetadata
	state.l.RUnlock()
	return rv
}

// Add or update a provider metadata field
func (state *State) UpdateProviderMetadata(key string, value interface{}) {
	state.l.Lock()
	if state.providerMetadata == nil {
		state.providerMetadata = make(map[string]interface{})
	}
	state.providerMetadata[key] = value
	state.l.Unlock()
}

// Set all provider metadata, overwriting an existing value
func (state *State) SetProviderMetadata(providerMetadata map[string]interface{}) {
	state.l.Lock()
	state.providerMetadata = providerMetadata
	state.l.Unlock()
}

// Get the current WorkerConfig
func (state *State) GetWorkerConfig() *cfg.WorkerConfig {
	state.l.RLock()
	rv := state.workerConfig
	state.l.RUnlock()
	return rv
}

// Merge the given WorkerConfig with any existing WorkerConfig
func (state *State) MergeWorkerConfig(workerConfig *cfg.WorkerConfig) {
	state.l.Lock()
	state.workerConfig = state.workerConfig.Merge(workerConfig)
	state.l.Unlock()
}

// Get the current set of Files
func (state *State) GetFiles() []files.File {
	state.l.RLock()
	rv := state.files
	state.l.RUnlock()
	return rv
}

// Add the given File instances to the state's Files
func (state *State) AppendFiles(files ...files.File) {
	state.l.Lock()
	state.files = append(state.files, files...)
	state.l.Unlock()
}

// Get a copy of the current worker location
func (state *State) GetWorkerLocation() map[string]string {
	state.l.RLock()
	rv := state.workerLocation
	state.l.RUnlock()
	return rv
}

// Set the current worker location state
func (state *State) SetWorkerLocation(workerLocation map[string]string) {
	state.l.Lock()
	state.workerLocation = workerLocation
	state.l.Unlock()
}

// TODO: State now marshals to nothing

// Check that the provided provided the information it was supposed to.
func (state *State) CheckProviderResults() error {
	state.l.RLock()
	defer state.l.RUnlock()

	if state.access.RootURL == "" {
		return fmt.Errorf("provider did not set RootURL")
	}

	if strings.HasSuffix(state.access.RootURL, "/") {
		return fmt.Errorf("RootURL must not end with `/`")
	}

	if state.access.Credentials.ClientID == "" {
		return fmt.Errorf("provider did not set Credentials.ClientID")
	}

	if state.identity.WorkerPoolID == "" {
		return fmt.Errorf("provider did not set WorkerPoolID")
	}

	if state.identity.WorkerGroup == "" {
		return fmt.Errorf("provider did not set WorkerGroup")
	}

	if state.identity.WorkerID == "" {
		return fmt.Errorf("provider did not set WorkerID")
	}

	if state.workerLocation["cloud"] == "" {
		return fmt.Errorf("provider did not set the cloud name")
	}

	return nil
}
