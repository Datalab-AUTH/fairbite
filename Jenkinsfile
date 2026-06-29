/*
 * Jenkinsfile to pull the source code from git, build the FairBite Docker
 * images using their Dockerfiles and push those images to a registry.
 */

pipeline {

  agent any

  environment {
    backend_dockertag = 'datalabauth/fairbite-backend'
    frontend_dockertag = 'datalabauth/fairbite-frontend'
    registry = 'https://registry.hub.docker.com'
    registry_credentials = 'dockerhub'
    REACT_APP_API_BASE = 'https://fairbite.csd.auth.gr/api'
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
