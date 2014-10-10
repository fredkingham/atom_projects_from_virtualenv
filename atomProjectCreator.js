var projectsDirectory = "~/.atom/projects.cson"
var sys = require('sys');
var exec = require('child_process').exec;
var lo = require("lodash")
var q = require("q")
var fs = require("fs")
var cson = require("season")
var PROJECT_FILE = ".atom/projects.cson";
var workonHome, projects;


function handledExec(cmd){
  var deferred = q.defer();

  exec(cmd, function(error, stdout, stderr){
    if(error){
      console.error("error " + error);
      deferred.reject(new Error(error));
    }
    else{
      deferred.resolve(stdout);
    }
  });

  return deferred.promise;
}


var getWorkonHome = lo.partial(handledExec, "source ~/.bashrc && echo $PROJECT_HOME");
var getHome = lo.partial(handledExec, "echo $HOME");
var readProjects = lo.partial(handledExec, "source ~/.bashrc && lsvirtualenv");

function AtomProject(projectPath, projectName){
    this.paths = [projectPath.trim() + "/" + projectName];
    this.title = projectName;
}

function checkProjectExists(atomProject){
  return _.map(atomProject.paths, function(x){
      var deferred = q.defer();

      if(fs.exists(x)){
          deferred.resolve(atomProject);
      }
      else{
          deferred.resolve(null);
      }

      return deferred.promise;
  });
}


function processProjects(){
    return readProjects().then(function(stdout){
        var result = lo.compact(lo.map(stdout.split("\n"), function(x){
            return x.replace(/=*/, "").trim();
        }));

        return result;
    });
}

function newProjects(){
    var allProjectsDeferred = q.defer();
    var allProjects;

    q.spread([getWorkonHome(), processProjects()], function(projectsHome, projects){
        projects = lo.map(projects, function(project){
            return new AtomProject(projectsHome, project);
        });

        q.spread(projects, function(){
            allProjects = lo.reduce(projects, function(memo, project){
                if(project){
                    memo[project.title] = project;
                    return memo;
                }
            }, {});

            allProjectsDeferred.resolve(allProjects);
        });
    });

    return allProjectsDeferred.promise;
}

function existingProjects(){
    var deferred = q.defer();

    getHome().then(function(homeDir){
        var projectsFileName = homeDir.trim() + "/" + PROJECT_FILE;
        deferred.resolve(cson.readFileSync(projectsFileName));
    });

    return deferred.promise;
}

function updateProjects(){
    var result;
    var projectsFile;

    q.spread([newProjects(), existingProjects(), getHome()], function(newProjs, existingProjs, homeDir){
        result = lo.extend(newProjs, existingProjs);
        projectsFile = homeDir.trim() + "/" + PROJECT_FILE;
        cson.writeFile(projectsFile, result, function(x){
            if(x){
                console.error("failed due to " + x);
            }
        });
    });
}

updateProjects();
