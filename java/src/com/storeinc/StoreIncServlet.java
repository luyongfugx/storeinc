package com.storeinc;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;




import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import com.alibaba.fastjson.JSONObject;

/**
 * 计算storeinc两个版本之间的增量文件
 * Servlet implementation class StoreIncServlet
 */
public class StoreIncServlet extends HttpServlet {
	//内容缓存
	private static ConcurrentHashMap<String, String> fileContentMap=new ConcurrentHashMap<String, String>();

	private static final long serialVersionUID = 1L;
    private String jsPath;
    private int chunkSize;

    /**
     * @see HttpServlet#HttpServlet()
     */
    public StoreIncServlet() {
        super();
        // TODO Auto-generated constructor stub
    }
    public void init(ServletConfig config) throws ServletException{
        this.jsPath=config.getInitParameter("jsPath");
        this.chunkSize=Integer.parseInt(config.getInitParameter("chunkSize"));
    }
    

	/**
	 * @see HttpServlet#doGet(HttpServletRequest request, HttpServletResponse response)
	 */
	/* (non-Javadoc)
	 * @see javax.servlet.http.HttpServlet#doGet(javax.servlet.http.HttpServletRequest, javax.servlet.http.HttpServletResponse)
	 */
	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		response.setHeader("Content-Type","application/x-javascript");
		String url=request.getRequestURI();
		String[] pathArray=url.split("storeinc");
		url=pathArray[1];
		String fullName=url;
		//如果内存已经有处理过的内容，则直接返回
		if(fileContentMap.containsKey(fullName)){
			response.getWriter().print(fileContentMap.get(fullName));
			response.getWriter().close();
			return;
		}
		String[] urlArray=url.split("/");
		int len=urlArray.length;
	    String pathName="";
		String lastver="";
		String ver="";
		String jsFileName="";
		boolean isFull=false;
		if(len>=2){
			String filename=urlArray[len-1];
			pathName=url.replace(filename, "");
			String[] sArray=filename.split("-");
			jsFileName=sArray[0];
			String verStr=sArray[1];
			//包含_说明请求的是增量文件
			if(verStr.contains("_")){
				String[] verArray=verStr.split("_");
				lastver=verArray[0];
				ver=verArray[1].replace(".js","");
			}
			else{
				ver=verStr.replace(".js","");
				isFull=true;
			}
		}


	
			String fullFile=this.jsPath+"/"+pathName+"/"+ver+"/"+jsFileName+"-"+ver+".js";
			String oldFile=jsPath+"/"+pathName+"/"+lastver+"/"+jsFileName+"-"+lastver+".js";
           //如果是全量
			DiffUtil dUtil=new DiffUtil();
			if(isFull){
            	String fullContent=dUtil.readFile(fullFile, "utf-8");
            	response.getWriter().print(fullContent);
            }
			else{
				JSONObject resultFile=dUtil.makeIncDataFromFile(oldFile, fullFile, this.chunkSize);
				fileContentMap.put(fullName, resultFile.toJSONString());	
				response.getWriter().print(resultFile.toJSONString());
			}

	
	
		//response.getWriter().print("s:"+url+" "+pathName+" "+lastver+" "+ver+" "+jsFileName);
		response.getWriter().close();
		
		
		// TODO Auto-generated method stub
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
	 */
	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		doGet(request,response);
		// TODO Auto-generated method stub
	}

}
