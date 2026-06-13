package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"
)

type spaFileServer struct {
	root http.Dir
}

func (server spaFileServer) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	path := request.URL.Path
	if path == "/" {
		path = "/index.html"
	}
	if file, err := server.root.Open(path); err == nil {
		_ = file.Close()
		http.FileServer(server.root).ServeHTTP(writer, request)
		return
	}
	request.URL.Path = "/index.html"
	http.FileServer(server.root).ServeHTTP(writer, request)
}

func executableDir() string {
	exe, err := os.Executable()
	if err != nil {
		wd, _ := os.Getwd()
		return wd
	}
	return filepath.Dir(exe)
}

func findDist(explicit string) (string, error) {
	candidates := []string{}
	if explicit != "" {
		candidates = append(candidates, explicit)
	}
	base := executableDir()
	wd, _ := os.Getwd()
	candidates = append(candidates,
		filepath.Join(base, "dist"),
		filepath.Join(base, "web", "dist"),
		filepath.Join(base, "..", "web", "dist"),
		filepath.Join(wd, "web", "dist"),
		filepath.Join(wd, "dist"),
	)
	for _, candidate := range candidates {
		index := filepath.Join(candidate, "index.html")
		if info, err := os.Stat(index); err == nil && !info.IsDir() {
			abs, _ := filepath.Abs(candidate)
			return abs, nil
		}
	}
	return "", fmt.Errorf("could not find web/dist with index.html")
}

func openBrowser(url string) {
	var command string
	var args []string
	switch runtime.GOOS {
	case "windows":
		command = "rundll32"
		args = []string{"url.dll,FileProtocolHandler", url}
	case "darwin":
		command = "open"
		args = []string{url}
	default:
		command = "xdg-open"
		args = []string{url}
	}
	if err := exec.Command(command, args...).Start(); err != nil {
		log.Printf("Open this URL in your browser: %s", url)
	}
}

func main() {
	distFlag := flag.String("dir", "", "Path to built PWA dist directory")
	noOpen := flag.Bool("no-open", false, "Do not open browser automatically")
	flag.Parse()

	dist, err := findDist(*distFlag)
	if err != nil {
		log.Fatal(err)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	url := fmt.Sprintf("http://127.0.0.1:%d/", port)

	server := &http.Server{
		Handler:           spaFileServer{root: http.Dir(dist)},
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("Serving Risk Assessment Tool from %s", dist)
		log.Printf("URL: %s", url)
		if !*noOpen {
			openBrowser(url)
		}
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}

