/*
 * grunt-contrib-storeinc
 * http://gruntjs.com/
 * waynelu
 * Copyright (c) 2012
 * Licensed under the MIT license.
 * https://github.com/gruntjs/grunt-contrib-storeinc/blob/master/LICENSE-MIT
 */

module.exports = function(grunt) {
  'use strict';
  var path = require('path');
  var crypto = require('crypto');
  grunt.registerMultiTask('storeinc', 'stroeinc files.', function() {
    var kindOf = grunt.util.kindOf;
    var options = this.options({
      processContent: false,
      processContentExclude: []
    });
    var copyOptions = {
      process: options.processContent,
      noProcess: options.processContentExclude
    };
    grunt.verbose.writeflags(options, 'Options');
    var dest;
    var isExpandedPair;
    var tally = {
      dirs: 0,
      files: 0
    };
    this.files.forEach(function(filePair) {
        var ver=filePair.version;
        var lastver=filePair.lastversion;
        var chunkSize=filePair.chunkSize;
      isExpandedPair = filePair.orig.expand || false;
        filePair.src.forEach(function(src) {
		if(grunt.file.match('*.js',src)){
            if (detectDestType(filePair.dest) === 'directory') {
              dest = (isExpandedPair) ? filePair.dest : unixifyPath(path.join(filePair.dest, src));
            } else {
              dest = filePair.dest;
            }
            if (grunt.file.isDir(src)) {
              grunt.verbose.writeln('Creating ' + dest.cyan);
              grunt.file.mkdir(dest);
              tally.dirs++;
            } else {
              var fileContent=grunt.file.read(src,copyOptions);
              var fullFile=src.replace('.js','-'+ver+'.js');
                console.log(fullFile);
              grunt.file.write(fullFile, fileContent, copyOptions);
              var oldFile=src.replace('.js','-'+lastver+'.js').replace(ver,lastver);
              if(grunt.file.exists(oldFile)){
                  var lastContent=grunt.file.read(oldFile,copyOptions);
                  var resultFile=makeIncDataFile(lastContent,fileContent,chunkSize);
                  var incFile=src.replace('.js','-'+lastver+'_'+ver+'.js');
                  grunt.file.write(incFile, JSON.stringify(resultFile), copyOptions);
              }
              tally.files++;
            }
        }
      });
    });
    if (tally.dirs) {
      grunt.log.write('Created ' + tally.dirs.toString().cyan + ' directories');
    }
    if (tally.files) {
      grunt.log.write((tally.dirs ? ', storeinc ' : 'storeinc ') + tally.files.toString().cyan + ' files');
    }
    grunt.log.writeln();
  });
  var detectDestType = function(dest) {
    if (grunt.util._.endsWith(dest, '/')) {
      return 'directory';
    } else {
      return 'file';
    }
  };
  var unixifyPath = function(filepath) {
    if (process.platform === 'win32') {
      return filepath.replace(/\\/g, '/');
    } else {
      return filepath;
    }
  };

var oldFileChecksum = function (txt,chunkSize) {
    var checksumArray={};
    var currentIndex=0;
    var len=txt.length;
    var chunkNo=0;
	while(currentIndex<len) {
       var chunk=txt.substr(currentIndex,chunkSize);
       var chunkMd5=getMd5ByText(chunk);
	   //用map来解决冲突,
	   var numArray=checksumArray[chunkMd5];
	   //如果没有过一个一样的
	   if(typeof(numArray)=='undefined'){
				numArray=new Array();
		}
	    numArray.push(chunkNo);
       checksumArray[chunkMd5]=numArray;
       currentIndex=currentIndex+chunkSize;

       chunkNo++;
	}

    return checksumArray;
};
function diffItem(m,dt){
    this.isMatch=m;
    this.data=dt;
};
var getMd5ByText = function (s) {
	var md5sum = crypto.createHash('md5');
	md5sum.update(s);
	return md5sum.digest('hex');
};
var getMatchNo=function(numArray,lastmatchNo){
	if(numArray.length==1){
		return numArray[0];
	}
	else{
		var lastNo=numArray[0];
		var reNo=0;
		for(var i=0;i<numArray.length;i++){
             var curNo=numArray[i];
			 if(curNo>=lastmatchNo&&lastNo<=lastmatchNo){
                 return (lastmatchNo-lastNo)>=(curNo-lastmatchNo)?curNo:lastNo;
			 }
			 else if(curNo>=lastmatchNo&&lastNo>=lastmatchNo){
		            return lastNo;
			 }
			 else if(curNo<=lastmatchNo&&lastNo<=lastmatchNo){
				 reNo=curNo;
			 }
			 else {
				 reNo=curNo;
			 }
			 lastNo=curNo;
		}
		return  reNo;
	}
}
var checkMatchIndex=function(chunkMd5,checksumArray,lastmatchNo){
  var numArray=checksumArray[chunkMd5];
   if(typeof(numArray)=='undefined'){
       return -1;
   }
   else{
       return getMatchNo(numArray,lastmatchNo);
   }
}
var doExactNewData=function( incDataArray,data){
    	var di = new diffItem(false,data);
    	incDataArray.push(di);
 }
var doExactMatch=function( incDataArray,chunkNo) {
		// 写块匹配
		var di = new diffItem(true,chunkNo);
		incDataArray.push(di);
}
var searchChunk=function(strInput,checksumArray,chunkSize){

    var incDataArray=new Array();
    //chunk
	var buffer=null;
	 //用于缓存两个匹配块之间的新增数据
	var outBuffer ="";
	// 指向块后的第一个字符
	var currentIndex = 0;
    var tLen=strInput.length;
	    var lastmatchNo=0;
    	while(currentIndex<=tLen){
			var endIndex=currentIndex+chunkSize;
			if(endIndex>tLen){
				endIndex=tLen;
			}
			buffer=strInput.substring(currentIndex,endIndex);

	        var chunkMd5=getMd5ByText(buffer);
			var matchTrunkIndex=checkMatchIndex(chunkMd5,checksumArray,lastmatchNo);

			//若果是最后一个
			if(endIndex>tLen-1){
				//先把新块压入队列
				if(outBuffer.length>0&&!outBuffer==""){
					doExactNewData(incDataArray,outBuffer);
					outBuffer="";
				}
				if(buffer.length>0&&!buffer==""){
					doExactNewData(incDataArray,buffer);
				}
				currentIndex=currentIndex+chunkSize;
			}
			//如果找到匹配块
			else if(matchTrunkIndex>=0){
				//先把新块压入队列
				if(outBuffer.length>0&&!outBuffer==""){
					doExactNewData(incDataArray,outBuffer);
					outBuffer="";
				}
				doExactMatch(incDataArray, matchTrunkIndex);
				currentIndex=currentIndex+chunkSize;

			}
			else{
				outBuffer=outBuffer+strInput.substring(currentIndex,currentIndex+1);
				currentIndex++;
			}
			if(matchTrunkIndex>=0){lastmatchNo=matchTrunkIndex};

		}
    return incDataArray;
};

var makeIncDataFile=function(oldFile,newFile,chunkSize){
    var resultFile={};
    //是否变更
    resultFile.modify=true;
    resultFile.chunkSize=chunkSize;
    var strDataArray=new Array();
    //计算新旧两个文件，如果相同则说明文件没有改动,则直接返回空数组
    if(getMd5ByText(oldFile)==getMd5ByText(newFile)){
        resultFile.modify=false;
        resultFile.data=strDataArray;
        return resultFile;
    }
  //  var oldChecksum=oldFileChecksum("F:/nginx-1.5.1/html/client-1000.js");

   // var diffArray=searchChunk("F:/nginx-1.5.1/html/server.js",oldChecksum);
    var oldChecksum=oldFileChecksum(oldFile,chunkSize);
    var diffArray=searchChunk(newFile,oldChecksum,chunkSize);
    var arrayData ="";
   // var newData="";
	var lastitem=null;
    var matchCount=0;
    var size=diffArray.length;


    for(var i=0;i<size;i++){

        var item=diffArray[i];
           //  if(oldFile.indexOf("home")>0){
             //   log("oldFile array:"+oldFile+" "+item.isMatch+" "+item.data);
           // }
        	if (item.isMatch) {
				//如果第一个匹配，
				if(lastitem==null||!lastitem.isMatch){
                    arrayData="["+item.data+",";
					matchCount=1;
				}
				else if(lastitem.isMatch&&lastitem.data+1==item.data){
					matchCount++;
				}
				else if(lastitem.isMatch&&(lastitem.data+1)!=item.data){
                    arrayData+=matchCount+"]";
                    strDataArray.push(JSON.parse(arrayData));
                    arrayData="["+item.data+","
					matchCount=1;
				}
				 if(i==(size-1)){
                      arrayData+=matchCount+"]";
                      strDataArray.push(JSON.parse(arrayData));
                      arrayData="";
				}
			} else {
				if(matchCount>0){
					arrayData+=matchCount+"]";
                    strDataArray.push(JSON.parse(arrayData));
                    arrayData="";
					matchCount=0;
				}
				//&quot;
				var data=item.data;
				//data=data.replace(/"/g, "&jsquot&&&;");
                strDataArray.push(data);
				//strData+="\"" +data +"\",";
			}
			lastitem=item;
    }
   // strData=strData.substr(0,strData.length-1);
  //  strData+="]";
   // console.log("xxxsadfadfa"+strData);
     resultFile.data=strDataArray;
    return resultFile;
}


};