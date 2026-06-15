/*
 * Jenkinsfile to pull the source code from git, build the FairBite Docker
 * images using their Dockerfiles and push those images to a registry.
 */

pipeline {

  agent any

  environment {
    backend_dockertag = 'fairbite-backend'
    frontend_dockertag = 'fairbite-frontend'
    registry = 'https://registry.csd.auth.gr'
    registry_credentials = 'datalab-registry'
    REACT_APP_API_BASE = 'http://localhost:8000'
  }

  // you probably don't need to edit anything below this line
  stages {

    stage('Checkout the source code') {
      steps {
        checkout scm
      }
    }

    stage('Build') {
      steps {
        script {
          backend_image = docker.build("$backend_dockertag", './fairbite-backend')
          frontend_image = docker.build(
            "$frontend_dockertag",
            "--build-arg REACT_APP_API_BASE=${REACT_APP_API_BASE} ./fairbite-frontend"
          )
        }
      }
    }

    stage('Push') {
      steps {
        script {
          docker.withRegistry(registry, registry_credentials) {
            backend_image.push()
            frontend_image.push()
          }
        }
      }
    }
  }
}
