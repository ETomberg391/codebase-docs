package main

import (
	"fmt"
	"os"
)

// Config holds application configuration
type Config struct {
	Name    string
	Port    int
	Debug   bool
}

// Server represents the HTTP server
type Server struct {
	config Config
}

// NewServer creates a new server instance
func NewServer(config Config) *Server {
	return &Server{config: config}
}

// Start starts the server
func (s *Server) Start() error {
	fmt.Printf("Starting server on port %d\n", s.config.Port)
	return nil
}

// Stop stops the server
func (s *Server) Stop() error {
	fmt.Println("Stopping server")
	return nil
}

const DefaultPort = 8080

func main() {
	config := Config{
		Name:  "app",
		Port:  DefaultPort,
		Debug: false,
	}

	server := NewServer(config)
	if err := server.Start(); err != nil {
		os.Exit(1)
	}
}
